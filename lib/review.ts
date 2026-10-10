/**
 * The review rubric. Pure data, so the reviewer form (client) and the score
 * queries (server, lib/db/review-sql.ts) weight scores identically.
 *
 * Each criterion is scored 1–5; an application's score is the mean of its
 * reviewers' weighted totals, so it's also on a 1–5 scale.
 */
export const RUBRIC = [
  {
    key: "skills",
    label: "Relevant skills and experience",
    hint: "Could they help a team ship an XR project in a weekend? Résumé, portfolio, skills.",
    weight: 0.5,
  },
  {
    key: "interest",
    label: "Demonstrated interest",
    hint: "Do they care about XR, and about this event specifically?",
    weight: 0.25,
  },
  {
    key: "personality",
    label: "Personality",
    hint: "Curiosity, energy, thoughtfulness. Would you want them on your team?",
    weight: 0.25,
  },
] as const;

export type RubricKey = (typeof RUBRIC)[number]["key"];
export type RubricScores = Record<RubricKey, number>;

export const SCORE_VALUES = [1, 2, 3, 4, 5] as const;

export const COMMENT_MAX = 2000;

/** An unsubmitted claim is released back to the queue after this long. */
export const CLAIM_TTL_MINUTES = 60;

export const DEFAULT_READS_PER_APPLICATION = 2;
export const MAX_READS_PER_APPLICATION = 5;

export function weightedScore(scores: RubricScores): number {
  return RUBRIC.reduce((sum, c) => sum + c.weight * scores[c.key], 0);
}

export type Outcome = "accepted" | "rejected" | "unscored";

/**
 * Where an application lands at a given score cutoff. Shared by the admin
 * slider (live counts) and the CSV export, so what admins see is what they
 * download. Under-18s are rejected regardless of score: eligibility is 18+ on
 * the event's first day.
 */
export function outcome(
  r: { score: number | null; under18: boolean },
  threshold: number,
): Outcome {
  if (r.under18) return "rejected";
  if (r.score === null) return "unscored";
  return r.score >= threshold ? "accepted" : "rejected";
}
