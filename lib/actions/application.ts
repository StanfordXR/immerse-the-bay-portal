"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  application,
  applicationEvent,
  userAttribution,
} from "@/lib/db/schema";
import { getAuthorizedUser } from "@/lib/dal";
import {
  ATTRIBUTION_COOKIE,
  parseAttribution,
  toAttributionColumns,
} from "@/lib/attribution";
import { applicationsAreClosed, closeDateLabel } from "@/lib/config";
import {
  answersToColumns,
  draftSchema,
  humanizeMessage,
  submitSchema,
  type Answers,
} from "@/lib/form-schema";
import { sendSubmissionConfirmation } from "@/lib/email";
import { ensureReferralCode } from "@/lib/referral";

export type SaveResult = { ok: true } | { ok: false; error: string };

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Copy the first-touch cookie onto user_attribution, once, best-effort. */
async function recordUserAttribution(userId: string): Promise<void> {
  const jar = await cookies();
  const attr = parseAttribution(jar.get(ATTRIBUTION_COOKIE)?.value);
  if (Object.keys(attr).length === 0) return;
  await db
    .insert(userAttribution)
    .values({ userId, ...toAttributionColumns(attr) })
    .onConflictDoNothing();
}

export async function saveDraft(raw: unknown): Promise<SaveResult> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "signed-out" };
  if (applicationsAreClosed()) return { ok: false, error: "closed" };

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const answers: Answers = parsed.data;
  const columns = answersToColumns(answers);

  await db
    .insert(application)
    .values({ userId: authz.user.id, answers, ...columns })
    .onConflictDoUpdate({
      target: application.userId,
      // Never touches `stage`: an edit after submitting stays submitted.
      set: { answers, ...columns },
    });

  await recordUserAttribution(authz.user.id).catch(() => {});

  return { ok: true };
}

export async function submitApplication(raw: unknown): Promise<SubmitResult> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "Your session expired — sign in again." };
  if (applicationsAreClosed()) {
    return { ok: false, error: "Applications have closed." };
  }

  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = humanizeMessage(issue.message);
    }
    return { ok: false, error: "Some answers need attention.", fieldErrors };
  }

  const answers = parsed.data;
  const columns = answersToColumns(answers);

  const [existing] = await db
    .select({
      id: application.id,
      submittedAt: application.submittedAt,
    })
    .from(application)
    .where(eq(application.userId, authz.user.id))
    .limit(1);

  const firstSubmit = !existing?.submittedAt;
  const submittedAt = existing?.submittedAt ?? new Date();

  // Attribution is stamped at submit so the application row itself can answer
  // "which source produced accepted applicants". Only fills empty columns —
  // a resubmit must not erase the original first touch.
  const jar = await cookies();
  const attr = parseAttribution(jar.get(ATTRIBUTION_COOKIE)?.value);
  const attrColumns = firstSubmit ? toAttributionColumns(attr) : {};

  const [row] = await db
    .insert(application)
    .values({
      userId: authz.user.id,
      answers,
      ...columns,
      ...attrColumns,
      stage: "submitted",
      submittedAt,
    })
    .onConflictDoUpdate({
      target: application.userId,
      set: {
        answers,
        ...columns,
        ...attrColumns,
        stage: "submitted",
        submittedAt,
      },
    })
    .returning({ id: application.id });

  await db.insert(applicationEvent).values({
    applicationId: row.id,
    actorId: authz.user.id,
    actorKind: "applicant",
    kind: firstSubmit ? "submitted" : "resubmitted",
  });

  // The static landing page reads this client-side to flip its CTA from
  // "Continue your application" to "View your application".
  jar.set("itb_applied", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  if (firstSubmit) {
    await ensureReferralCode(authz.user.id).catch(() => {});
    const email = authz.user.email;
    const name = answers.firstName || "there";
    const close = closeDateLabel();
    after(async () => {
      try {
        await sendSubmissionConfirmation(email, name, close);
      } catch (err) {
        console.error("[email] confirmation failed:", err);
      }
    });
  }

  return { ok: true };
}
