import "server-only";
import { randomInt } from "crypto";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, applicationEvent, referralClaim } from "@/lib/db/schema";
import { parseReferralCookie } from "@/lib/referral-cookie";

/**
 * Applicant referral system.
 *
 * A personal code is minted when an application is first submitted — the
 * leaderboard and referral link are deliberately invisible until then, so the
 * incentive points at finishing your own application first. Personal referral
 * ownership is stored in referral_claim, independently of marketing first-touch
 * attribution. Only completed applications count — a
 * fake click is free, but a fake completed application costs ten minutes of
 * essays per unit, which makes farming uneconomical.
 */

// Crockford-ish alphabet: no 0/o, 1/l/i — codes get read aloud and retyped.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/**
 * Assign a referral code to a submitted application, if it doesn't have one.
 * Idempotent; safe to call from the submit action and lazily from the
 * dashboard (covers applications submitted before this feature existed).
 */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const [row] = await db
    .select({
      id: application.id,
      code: application.referralCode,
      submittedAt: application.submittedAt,
    })
    .from(application)
    .where(eq(application.userId, userId))
    .limit(1);

  if (!row || !row.submittedAt) return null; // codes exist only post-submit
  if (row.code) return row.code;

  // Retry on the (astronomically unlikely) unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const [updated] = await db
        .update(application)
        .set({ referralCode: code })
        .where(and(eq(application.id, row.id), sql`referral_code IS NULL`))
        .returning({ code: application.referralCode });
      if (updated?.code) return updated.code;

      // Another request may have won the conditional update. Return the code
      // that actually persisted rather than a phantom code that cannot resolve.
      const [winner] = await db
        .select({ code: application.referralCode })
        .from(application)
        .where(eq(application.id, row.id))
        .limit(1);
      if (winner?.code) return winner.code;
    } catch (error) {
      // PostgreSQL 23505 is the only expected retryable failure here.
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "23505"
      ) {
        throw error;
      }
      continue;
    }
  }
  return null;
}

/**
 * Persist the first valid personal referral before this user's first submit.
 *
 * The browser cookie bridges the unauthenticated click to sign-up. Once the
 * user saves a draft, this row becomes the durable, cross-device source of
 * truth. Acquisition UTMs are intentionally left untouched.
 */
export async function recordReferralClaim(
  userId: string,
  rawCookie: string | null | undefined,
): Promise<void> {
  const referral = parseReferralCookie(rawCookie);
  if (!referral) return;

  const [referredApplication] = await db
    .select({
      id: application.id,
      submittedAt: application.submittedAt,
    })
    .from(application)
    .where(eq(application.userId, userId))
    .limit(1);

  // Never add or change referral credit after the person's first submission,
  // including when a rejected application is later reopened for revision.
  if (referredApplication?.submittedAt) return;
  if (referredApplication) {
    const [priorSubmission] = await db
      .select({ id: applicationEvent.id })
      .from(applicationEvent)
      .where(
        and(
          eq(applicationEvent.applicationId, referredApplication.id),
          inArray(applicationEvent.kind, ["submitted", "resubmitted"]),
        ),
      )
      .limit(1);
    if (priorSubmission) return;
  }

  const [referrer] = await db
    .select({ id: application.id })
    .from(application)
    .where(
      and(
        eq(application.referralCode, referral.code),
        isNotNull(application.submittedAt),
        ne(application.userId, userId),
      ),
    )
    .limit(1);
  if (!referrer) return;

  await db
    .insert(referralClaim)
    .values({
      referredUserId: userId,
      referrerApplicationId: referrer.id,
      referralCode: referral.code,
      entryPoint: referral.entryPoint,
      clickedAt: new Date(referral.clickedAt),
    })
    // First valid referral wins. Later links cannot poach an existing claim.
    .onConflictDoNothing();
}

export type LeaderboardRow = {
  code: string;
  displayName: string;
  count: number;
  isYou: boolean;
};

/**
 * Top referrers plus the viewing user's own row. Counts only submitted,
 * non-staff, non-test applications and honours the anonymity toggle.
 * Plain SQL via execute — the correlated subquery is clearer that way.
 */
export async function getLeaderboard(
  viewerCode: string | null,
  limit = 10,
): Promise<{ top: LeaderboardRow[]; you: LeaderboardRow | null }> {
  const result = await db.execute(sql`
    select a.referral_code as code,
           a.referral_anonymous as anonymous,
           a.first_name,
           a.last_name,
           (select count(*)::int from application r
             join referral_claim c on c.referred_user_id = r.user_id
             where c.referrer_application_id = a.id
               and r.submitted_at is not null
               and r.id <> a.id
               and not exists (
                 select 1 from "user" staff
                 where staff.id = r.user_id
                   and coalesce(staff.role, 'applicant') <> 'applicant'
               )
               and not exists (
                 select 1
                 from application_tag assignment
                 join tag t on t.id = assignment.tag_id
                 where assignment.application_id = r.id
                   and t.name = 'test-account'
               )) as count
    from application a
    where a.referral_code is not null
      and a.submitted_at is not null
    order by 5 desc, a.referral_code asc
  `);

  type Raw = {
    code: string;
    anonymous: boolean;
    first_name: string | null;
    last_name: string | null;
    count: number;
  };

  const sorted = (result.rows as Raw[]).map(
    (r): LeaderboardRow => ({
      code: r.code,
      displayName: r.anonymous
        ? "Anonymous"
        : [r.first_name, r.last_name?.[0] ? `${r.last_name[0]}.` : ""]
            .filter(Boolean)
            .join(" ") || "Anonymous",
      count: Number(r.count),
      isYou: r.code === viewerCode,
    }),
  );

  const top = sorted.filter((r) => r.count > 0).slice(0, limit);
  const you = sorted.find((r) => r.isYou) ?? null;

  return { top, you };
}
