import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, applicationEvent, user } from "@/lib/db/schema";
import { RSVP_WINDOW_DAYS } from "@/lib/config";
import { sendDecisionReleased } from "@/lib/email";

/**
 * Publishing decisions to hackers. Not server actions: callers authorize
 * first (lib/actions/decision.ts, lib/actions/admin.ts) and pass the admin.
 */

const rsvpDeadline = () => new Date(Date.now() + RSVP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

async function notify(applicationId: string): Promise<boolean> {
  const [to] = await db
    .select({ email: user.email, firstName: application.firstName })
    .from(application)
    .innerJoin(user, eq(application.userId, user.id))
    .where(eq(application.id, applicationId))
    .limit(1);
  if (!to) return false;
  try {
    await sendDecisionReleased(to.email, to.firstName ?? "there");
    return true;
  } catch (error) {
    console.error(`[decisions] email for application ${applicationId} failed`, error);
    return false;
  }
}

/**
 * Release one marked decision: it appears on the hacker's dashboard, an
 * accepted hacker's RSVP window opens, and they get a status-update email.
 * Returns null if it was already released (double-click, two admins).
 */
export async function releaseDecision(
  applicationId: string,
  actorId: string,
): Promise<{ emailed: boolean } | null> {
  const [released] = await db
    .update(application)
    .set({ stage: "decided" })
    .where(and(eq(application.id, applicationId), ne(application.stage, "decided")))
    .returning({ decision: application.decision });
  if (!released) return null;

  if (released.decision === "accepted") {
    await db
      .update(application)
      .set({ rsvp: "pending", rsvpDeadline: rsvpDeadline() })
      .where(eq(application.id, applicationId));
  }
  await db.insert(applicationEvent).values({
    applicationId,
    actorId,
    actorKind: "admin",
    kind: "decision_released",
    payload: { decision: released.decision },
  });
  return { emailed: await notify(applicationId) };
}

/** Accept a released waitlisted hacker: opens their RSVP and emails them now. */
export async function acceptFromWaitlist(
  applicationId: string,
  actorId: string,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [promoted] = await db
    .update(application)
    .set({
      decision: "accepted",
      decidedAt: new Date(),
      decisionNote: note || null,
      rsvp: "pending",
      rsvpDeadline: rsvpDeadline(),
    })
    .where(
      and(
        eq(application.id, applicationId),
        eq(application.stage, "decided"),
        eq(application.decision, "waitlisted"),
      ),
    )
    .returning({ id: application.id });
  if (!promoted) return { ok: false, error: "Only a waitlisted hacker can be accepted after release." };

  await db.insert(applicationEvent).values({
    applicationId,
    actorId,
    actorKind: "admin",
    kind: "accepted_from_waitlist",
    payload: { note },
  });
  await notify(applicationId);
  return { ok: true };
}
