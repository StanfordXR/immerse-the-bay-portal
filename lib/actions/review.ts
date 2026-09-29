"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { application, applicationEvent, review, reviewConfig } from "@/lib/db/schema";
import { applicantOwnedOnly } from "@/lib/db/applicant-filter";
import { getReadsPerApplication, readsTakenSql } from "@/lib/db/review-sql";
import { getAuthorizedUser } from "@/lib/dal";
import {
  CLAIM_TTL_MINUTES,
  COMMENT_MAX,
  MAX_READS_PER_APPLICATION,
} from "@/lib/review";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Pull the next application from the shared queue and send the reviewer to
 * it. Form action on /review.
 *
 * An application is claimable while its reads (submitted reviews plus open
 * claims) are below the admin-set target and this reviewer hasn't touched it.
 * Least-read first, so every application gets one read before any gets a
 * second; ties broken by `queue_seed`, so order is random rather than by
 * submission time. `FOR UPDATE SKIP LOCKED` spreads reviewers clicking at
 * once across different applications. It isn't a hard cap: a claim racing a
 * just-committed one can still see the old read count and add one read over
 * target, which only costs a reviewer a few minutes.
 */
export async function claimNext(): Promise<void> {
  const authz = await getAuthorizedUser("reviewer", "admin");
  if (!authz) redirect("/sign-in");
  const me = authz.user.id;
  const reads = await getReadsPerApplication();

  const applicationId = await db.transaction(async (tx) => {
    await tx
      .delete(review)
      .where(
        and(
          isNull(review.submittedAt),
          lt(review.claimedAt, sql`now() - make_interval(mins => ${CLAIM_TTL_MINUTES})`),
        ),
      );

    // Finish what you started before taking something new.
    const [open] = await tx
      .select({ applicationId: review.applicationId })
      .from(review)
      .where(and(eq(review.reviewerId, me), isNull(review.submittedAt)))
      .limit(1);
    if (open) return open.applicationId;

    const [next] = await tx
      .select({ id: application.id })
      .from(application)
      .where(
        and(
          isNotNull(application.submittedAt),
          applicantOwnedOnly,
          sql`not exists (select 1 from ${review} mine where mine.application_id = "application"."id" and mine.reviewer_id = ${me})`,
          sql`${readsTakenSql} < ${reads}`,
        ),
      )
      .orderBy(readsTakenSql, application.queueSeed)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return null;

    await tx
      .insert(review)
      .values({ applicationId: next.id, reviewerId: me })
      .onConflictDoNothing();
    return next.id;
  });

  redirect(applicationId ? `/review/${applicationId}` : "/review?empty=1");
}

const score = z.number().int().min(1).max(5);
const reviewInput = z.object({
  applicationId: z.uuid(),
  skills: score,
  interest: score,
  personality: score,
  comment: z.string().trim().max(COMMENT_MAX),
});

/**
 * Score an application, or re-score one you already reviewed. Upserts, so a
 * claim that expired while the reviewer was reading still lands (at worst one
 * read over target, which is harmless).
 */
export async function submitReview(raw: z.input<typeof reviewInput>): Promise<Result> {
  const authz = await getAuthorizedUser("reviewer", "admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  const parsed = reviewInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Score every category from 1 to 5." };
  const { applicationId, comment, skills, interest, personality } = parsed.data;

  const [target] = await db
    .select({ id: application.id })
    .from(application)
    .where(
      and(
        eq(application.id, applicationId),
        isNotNull(application.submittedAt),
        applicantOwnedOnly,
      ),
    )
    .limit(1);
  if (!target) return { ok: false, error: "That application isn't open for review." };

  const [existing] = await db
    .select({ submittedAt: review.submittedAt })
    .from(review)
    .where(and(eq(review.applicationId, applicationId), eq(review.reviewerId, authz.user.id)))
    .limit(1);

  const scores = { skills, interest, personality, comment: comment || null };
  await db
    .insert(review)
    .values({ applicationId, reviewerId: authz.user.id, ...scores, submittedAt: new Date() })
    .onConflictDoUpdate({
      target: [review.applicationId, review.reviewerId],
      // Keep the first submission time; edits only change the scores.
      set: { ...scores, submittedAt: sql`coalesce(${review.submittedAt}, now())` },
    });

  await db.insert(applicationEvent).values({
    applicationId,
    actorId: authz.user.id,
    actorKind: authz.role,
    kind: existing?.submittedAt ? "review_updated" : "review_submitted",
  });

  revalidatePath("/review");
  revalidatePath("/admin/review");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}

/** Hand an unscored claim back to the queue. Form action on /review/[id]. */
export async function releaseClaim(applicationId: string): Promise<void> {
  const authz = await getAuthorizedUser("reviewer", "admin");
  if (!authz) redirect("/sign-in");
  await db
    .delete(review)
    .where(
      and(
        eq(review.applicationId, applicationId),
        eq(review.reviewerId, authz.user.id),
        isNull(review.submittedAt),
      ),
    );
  redirect("/review");
}

/**
 * How many reviewers read each application. Applies to the queue immediately;
 * lowering it never deletes reviews already written.
 */
export async function setReadsPerApplication(reads: number): Promise<Result> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  if (!Number.isInteger(reads) || reads < 1 || reads > MAX_READS_PER_APPLICATION) {
    return { ok: false, error: `Between 1 and ${MAX_READS_PER_APPLICATION}.` };
  }
  await db
    .insert(reviewConfig)
    .values({ id: 1, readsPerApplication: reads })
    .onConflictDoUpdate({ target: reviewConfig.id, set: { readsPerApplication: reads } });
  revalidatePath("/admin/review");
  revalidatePath("/review");
  return { ok: true };
}
