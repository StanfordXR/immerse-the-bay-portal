"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, applicationEvent } from "@/lib/db/schema";
import { unreleasedDecision } from "@/lib/db/applicant-filter";
import { getAuthorizedUser } from "@/lib/dal";
import { releaseDecision } from "@/lib/decisions";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Publish every marked decision and email each hacker a status update.
 * Admin only; button on /admin/review.
 *
 * One application at a time, each released before its email goes out, so a
 * run cut short (timeout, Resend error) can simply be clicked again: it picks
 * up exactly the applications still unreleased and never emails anyone twice.
 */
export async function releaseDecisions(): Promise<Result<{ released: number; emailFailures: number }>> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };

  const pending = await db
    .select({ id: application.id })
    .from(application)
    .where(unreleasedDecision);

  let released = 0;
  let emailFailures = 0;
  for (const { id } of pending) {
    const result = await releaseDecision(id, authz.user.id);
    if (!result) continue;
    released++;
    if (!result.emailed) emailFailures++;
    // Resend's default limit is 2 requests per second.
    await new Promise((r) => setTimeout(r, 550));
  }

  revalidatePath("/admin/review");
  revalidatePath("/admin/applications");
  return { ok: true, released, emailFailures };
}

/**
 * An accepted hacker confirms or declines their spot, until the RSVP
 * deadline. A confirmed hacker can still decline (it frees the spot), but a
 * decline is final.
 */
export async function respondToInvite(choice: "confirmed" | "declined"): Promise<Result> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "Sign in again to RSVP." };
  if (choice !== "confirmed" && choice !== "declined") {
    return { ok: false, error: "Unknown response." };
  }

  const [updated] = await db
    .update(application)
    .set({ rsvp: choice, rsvpAt: new Date() })
    .where(
      and(
        eq(application.userId, authz.user.id),
        eq(application.stage, "decided"),
        eq(application.decision, "accepted"),
        inArray(application.rsvp, choice === "confirmed" ? ["pending"] : ["pending", "confirmed"]),
        gt(application.rsvpDeadline, new Date()),
      ),
    )
    .returning({ id: application.id });
  if (!updated) {
    return { ok: false, error: "This RSVP is closed. Email admin@stanfordxr.org if that's a mistake." };
  }

  await db.insert(applicationEvent).values({
    applicationId: updated.id,
    actorId: authz.user.id,
    actorKind: "applicant",
    kind: `rsvp_${choice}`,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
