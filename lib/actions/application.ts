"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { and, eq, inArray, ne } from "drizzle-orm";
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
import { REFERRAL_COOKIE } from "@/lib/referral-cookie";
import { getApplicationWindow } from "@/lib/application-window";
import { closeDateLabel, finalDecisionsLabel } from "@/lib/config";
import {
  answersToColumns,
  draftSchema,
  humanizeMessage,
  submitSchema,
  type Answers,
} from "@/lib/form-schema";
import { sendRevisionConfirmation, sendSubmissionConfirmation } from "@/lib/email";
import { ensureReferralCode, recordReferralClaim } from "@/lib/referral";
import { canFinishAcceptedDraft } from "@/lib/application-access";

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

/** Bind a browser referral to this account, then remove the browser handoff. */
async function recordReferralFromCookies(
  userId: string,
  jar: Awaited<ReturnType<typeof cookies>>,
): Promise<void> {
  const raw = jar.get(REFERRAL_COOKIE)?.value;
  if (!raw) return;

  // Leave the cookie in place after a transient failure so the next autosave
  // can retry. Once processed (including invalid/self/ineligible claims), clear
  // it so another person using the same browser cannot inherit the referral.
  try {
    await recordReferralClaim(userId, raw);
    jar.set({
      name: REFERRAL_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      ...(process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
    });
  } catch (error) {
    console.error("[referral] claim persistence failed:", error);
  }
}

// Generous ceiling on the serialized answers object; individual fields are
// zod-capped far below this. Guards storage and parsing cost, not honesty.
const MAX_PAYLOAD_CHARS = 64_000;

export async function saveDraft(raw: unknown): Promise<SaveResult> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "signed-out" };
  if (!(await getApplicationWindow()).accepting) {
    const [existing] = await db
      .select({
        decision: application.decision,
        stage: application.stage,
        submittedAt: application.submittedAt,
      })
      .from(application)
      .where(eq(application.userId, authz.user.id))
      .limit(1);
    if (!canFinishAcceptedDraft(existing)) {
      return { ok: false, error: "closed" };
    }
  }
  // JSON.stringify(undefined) is undefined; a crafted call must degrade to
  // "invalid", not throw.
  if ((JSON.stringify(raw) ?? "").length > MAX_PAYLOAD_CHARS) {
    return { ok: false, error: "invalid" };
  }

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const answers: Answers = parsed.data;
  const columns = answersToColumns(answers);

  const saved = await db
    .insert(application)
    .values({ userId: authz.user.id, answers, ...columns })
    .onConflictDoUpdate({
      target: application.userId,
      // Never touches `stage`: an edit after submitting stays submitted.
      set: { answers, ...columns },
      // Locked once the decision is released.
      setWhere: ne(application.stage, "decided"),
    })
    .returning({ id: application.id });
  if (saved.length === 0) return { ok: false, error: "locked" };

  const jar = await cookies();
  await Promise.all([
    recordUserAttribution(authz.user.id).catch(() => {}),
    recordReferralFromCookies(authz.user.id, jar),
  ]);

  return { ok: true };
}

export async function submitApplication(raw: unknown): Promise<SubmitResult> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "Your session expired — sign in again." };
  const [existing] = await db
    .select({
      id: application.id,
      decision: application.decision,
      submittedAt: application.submittedAt,
      stage: application.stage,
    })
    .from(application)
    .where(eq(application.userId, authz.user.id))
    .limit(1);
  const applicationWindow = await getApplicationWindow();
  if (!applicationWindow.accepting && !canFinishAcceptedDraft(existing)) {
    return { ok: false, error: "Applications have closed." };
  }
  if ((JSON.stringify(raw) ?? "").length > MAX_PAYLOAD_CHARS) {
    return { ok: false, error: "Some answers are too long." };
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

  // Resubmitting would reset `stage` and un-release the decision.
  if (existing?.stage === "decided") {
    return { ok: false, error: "Your decision is out, so your application is locked. See your dashboard." };
  }

  const [revision] = existing
    ? await db
        .select({ id: applicationEvent.id })
        .from(applicationEvent)
        .where(
          and(
            eq(applicationEvent.applicationId, existing.id),
            inArray(applicationEvent.kind, ["revision_archived", "reopened_after_rejection"]),
          ),
        )
        .limit(1)
    : [];
  const firstSubmit = !existing?.submittedAt && !revision;
  const revisedSubmit = !existing?.submittedAt && Boolean(revision);
  const submittedAt = existing?.submittedAt ?? new Date();

  // Attribution is stamped at submit so the application row itself can answer
  // "which source produced accepted applicants". Only fills empty columns —
  // a resubmit must not erase the original first touch.
  const jar = await cookies();
  const attr = parseAttribution(jar.get(ATTRIBUTION_COOKIE)?.value);
  const attrColumns = firstSubmit ? toAttributionColumns(attr) : {};

  // Referral ownership is independent of acquisition attribution. Persist it
  // before the first submission flips this application out of the eligible
  // draft state. A failure must never block the application itself; normal
  // autosave has already attempted the same durable write.
  if (firstSubmit) {
    await recordReferralFromCookies(authz.user.id, jar);
  }

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
    payload: revisedSubmit ? { revision: true } : {},
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
    const close = closeDateLabel(applicationWindow.deadline);
    const finalDecisions = finalDecisionsLabel(applicationWindow.deadline);
    after(async () => {
      try {
        await sendSubmissionConfirmation(email, name, close, finalDecisions);
      } catch (err) {
        console.error("[email] confirmation failed:", err);
      }
    });
  } else if (revisedSubmit) {
    const email = authz.user.email;
    const name = answers.firstName || "there";
    after(async () => {
      try {
        await sendRevisionConfirmation(email, name);
      } catch (err) {
        console.error("[email] revision confirmation failed:", err);
      }
    });
  }

  return { ok: true };
}
