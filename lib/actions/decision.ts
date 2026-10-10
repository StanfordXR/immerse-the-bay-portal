"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, applicationEvent, review } from "@/lib/db/schema";
import { unreleasedDecision } from "@/lib/db/applicant-filter";
import { getReviewResults } from "@/lib/db/review-sql";
import { getAuthorizedUser } from "@/lib/dal";
import { ageAtEvent, applicationsAreClosed, RSVP_WINDOW_DAYS } from "@/lib/config";
import { outcome } from "@/lib/review";
import { rsvpFormSchema, type RsvpDetails } from "@/lib/rsvp";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/* ── admin ─────────────────────────────────────────────────────────────── */

/**
 * Mark every scored, unreleased application accepted or rejected at a score
 * cutoff, exactly as the /admin/review slider shows it. Overwrites earlier
 * unreleased marks (including hand edits), so hand-adjust after this, not before.
 */
export async function applyCutoff(threshold: number): Promise<Result<{ accepted: number; rejected: number }>> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 5) {
    return { ok: false, error: "Cutoff must be between 1 and 5." };
  }

  const results = await getReviewResults();
  const ids = { accepted: [] as string[], rejected: [] as string[] };
  for (const r of results) {
    const o = outcome(r, threshold);
    if (o !== "unscored") ids[o].push(r.id);
  }

  const counts = { accepted: 0, rejected: 0 };
  for (const decision of ["accepted", "rejected"] as const) {
    if (ids[decision].length === 0) continue;
    const marked = await db
      .update(application)
      .set({ decision, decidedAt: new Date() })
      .where(and(inArray(application.id, ids[decision]), ne(application.stage, "decided")))
      .returning({ id: application.id });
    counts[decision] = marked.length;
    if (marked.length > 0) {
      await db.insert(applicationEvent).values(
        marked.map(({ id }) => ({
          applicationId: id,
          actorId: authz.user.id,
          actorKind: "admin",
          kind: "decision_set",
          payload: { decision, via: "cutoff", threshold },
        })),
      );
    }
  }

  revalidatePath("/admin/review");
  revalidatePath("/admin/applications");
  return { ok: true, ...counts };
}

/**
 * Publish every marked decision to hackers' dashboards. Accepted hackers get
 * RSVP_WINDOW_DAYS to confirm. Sends no email: organizers email hackers
 * themselves, pointing them at /dashboard. Released decisions are locked.
 */
export async function releaseDecisions(): Promise<Result<{ released: number }>> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };

  const accepted = sql`${application.decision} = 'accepted'`;
  const released = await db
    .update(application)
    .set({
      stage: "decided",
      rsvp: sql`case when ${accepted} then 'pending'::rsvp_state end`,
      rsvpDeadline: sql`case when ${accepted} then now() + make_interval(days => ${RSVP_WINDOW_DAYS}) end`,
    })
    .where(unreleasedDecision)
    .returning({ id: application.id, decision: application.decision });

  if (released.length > 0) {
    await db.insert(applicationEvent).values(
      released.map(({ id, decision }) => ({
        applicationId: id,
        actorId: authz.user.id,
        actorKind: "admin",
        kind: "decision_released",
        payload: { decision },
      })),
    );
  }

  revalidatePath("/admin/review");
  revalidatePath("/admin/applications");
  return { ok: true, released: released.length };
}

/* ── hacker ────────────────────────────────────────────────────────────── */

/** An accepted hacker's application while their RSVP window is open. */
const rsvpOpen = (userId: string) =>
  and(
    eq(application.userId, userId),
    eq(application.stage, "decided"),
    eq(application.decision, "accepted"),
    inArray(application.rsvp, ["pending", "confirmed"]),
    gt(application.rsvpDeadline, new Date()),
  );

export type ConfirmResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Confirm a spot from /rsvp, or update the details of an existing
 * confirmation until the deadline. Agreement timestamps keep the first time
 * each box was ticked.
 */
export async function confirmSpot(raw: unknown): Promise<ConfirmResult> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "Sign in again to RSVP." };

  const parsed = rsvpFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Some answers need attention.", fieldErrors };
  }
  const form = parsed.data;

  const [current] = await db
    .select({ id: application.id, rsvp: application.rsvp, details: application.rsvpDetails })
    .from(application)
    .where(rsvpOpen(authz.user.id))
    .limit(1);
  if (!current) return { ok: false, error: "This RSVP is closed. Email admin@stanfordxr.org if that's a mistake." };

  const now = new Date().toISOString();
  const details: RsvpDetails = {
    pronouns: form.pronouns || null,
    phone: form.phone || null,
    emergencyContact: { name: form.emergencyName, email: form.emergencyEmail, phone: form.emergencyPhone },
    agreedAt: {
      codeOfConduct: current.details?.agreedAt.codeOfConduct ?? now,
      photoConsent: current.details?.agreedAt.photoConsent ?? now,
      liability: current.details?.agreedAt.liability ?? now,
    },
  };

  const firstConfirm = current.rsvp === "pending";
  await db
    .update(application)
    .set({
      tshirtSize: form.tshirtSize,
      dietaryNeeds: form.dietary,
      rsvpDetails: details,
      rsvp: "confirmed",
      ...(firstConfirm ? { rsvpAt: new Date() } : {}),
    })
    .where(eq(application.id, current.id));

  await db.insert(applicationEvent).values({
    applicationId: current.id,
    actorId: authz.user.id,
    actorKind: "applicant",
    kind: firstConfirm ? "rsvp_confirmed" : "rsvp_updated",
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Give up a spot, pending or confirmed, until the deadline. Final. */
export async function declineSpot(): Promise<Result> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "Sign in again to RSVP." };

  const [updated] = await db
    .update(application)
    .set({ rsvp: "declined", rsvpAt: new Date() })
    .where(rsvpOpen(authz.user.id))
    .returning({ id: application.id });
  if (!updated) return { ok: false, error: "This RSVP is closed. Email admin@stanfordxr.org if that's a mistake." };

  await db.insert(applicationEvent).values({
    applicationId: updated.id,
    actorId: authz.user.id,
    actorKind: "applicant",
    kind: "rsvp_declined",
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * A rejected hacker reopens their application to revise it. It becomes a
 * draft again: decision cleared, old reviews discarded (counted in the event
 * log), and it only re-enters the review queue once they resubmit before
 * applications close. Not offered to under-18s, who are ineligible regardless.
 */
export async function reviseApplication(): Promise<void> {
  const authz = await getAuthorizedUser();
  if (!authz) redirect("/sign-in");

  const [app] = await db
    .select({ id: application.id, dateOfBirth: application.dateOfBirth, note: application.decisionNote })
    .from(application)
    .where(
      and(
        eq(application.userId, authz.user.id),
        eq(application.stage, "decided"),
        eq(application.decision, "rejected"),
      ),
    )
    .limit(1);
  const age = ageAtEvent(app?.dateOfBirth ?? null);
  if (!app || applicationsAreClosed() || (age !== null && age < 18)) redirect("/dashboard");

  await db.transaction(async (tx) => {
    const cleared = await tx.delete(review).where(eq(review.applicationId, app.id)).returning({ id: review.id });
    await tx
      .update(application)
      .set({ stage: "draft", decision: null, decidedAt: null, decisionNote: null, submittedAt: null })
      .where(eq(application.id, app.id));
    await tx.insert(applicationEvent).values({
      applicationId: app.id,
      actorId: authz.user.id,
      actorKind: "applicant",
      kind: "reopened_after_rejection",
      payload: { reviewsCleared: cleared.length, decisionNote: app.note },
    });
  });

  redirect("/apply?revise=1");
}
