import "server-only";
import { randomInt } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";

/**
 * Applicant referral system.
 *
 * A personal code is minted when an application is first submitted — the
 * leaderboard and referral link are deliberately invisible until then, so the
 * incentive points at finishing your own application first. A referred
 * application carries `utm_source='ref'` + `utm_content=<code>` via the normal
 * first-touch cookie, and ONLY completed (submitted) applications count — a
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
      await db
        .update(application)
        .set({ referralCode: code })
        .where(and(eq(application.id, row.id), sql`referral_code IS NULL`));
      return code;
    } catch {
      continue;
    }
  }
  return null;
}

export type LeaderboardRow = {
  code: string;
  displayName: string;
  count: number;
  isYou: boolean;
};

/**
 * Top referrers plus the viewing user's own row. Counts only submitted
 * applications, excludes self-referrals, and honours the anonymity toggle.
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
             where r.utm_source = 'ref'
               and r.utm_content = a.referral_code
               and r.submitted_at is not null
               and r.id <> a.id) as count
    from application a
    where a.referral_code is not null
      and a.submitted_at is not null
    order by 5 desc
    limit 200
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
