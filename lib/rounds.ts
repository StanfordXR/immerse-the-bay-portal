import { outcome } from "./review";

/**
 * Decision rounds. Pure logic, shared by /admin/review (live counts, client)
 * and the server actions that mark and release decisions, so the numbers an
 * admin sanity-checks are exactly the set the server acts on.
 *
 *   priority  first submitted on or before NEXT_PUBLIC_PRIORITY_DEADLINE and
 *             never revised. A revised application is reviewed fresh in the
 *             regular round, however early it was first submitted.
 *   regular   later submissions plus every reopened revision.
 *   all       every application, regardless of round.
 */
export const SCOPES = ["priority", "regular", "all"] as const;
export type Scope = (typeof SCOPES)[number];

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && (SCOPES as readonly string[]).includes(value);
}

/** Event kinds that mark a rejected application reopened for revision. */
export const REVISION_EVENT_KINDS = ["revision_archived", "reopened_after_rejection"] as const;

export type RoundFacts = {
  /** Earliest submission ever, in epoch ms: survives edits and revisions. */
  firstSubmittedMs: number | null;
  /** How many times the application was reopened for revision. */
  revisions: number;
};

/** Normalize computed database timestamps, which Neon may return as strings. */
export function normalizeTimestamp(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPriority(f: RoundFacts, deadline: Date | null): boolean {
  if (!deadline || f.firstSubmittedMs === null) return false;
  return f.revisions === 0 && f.firstSubmittedMs <= deadline.getTime();
}

export function inScope(priority: boolean, scope: Scope): boolean {
  if (scope === "all") return true;
  return scope === "priority" ? priority : !priority;
}

export type CutoffRow = {
  id: string;
  stage: string;
  score: number | null;
  reads: number;
  under18: boolean;
  priority: boolean;
};

export type CutoffPlan = {
  accepted: string[];
  rejected: string[];
  /** Scored, but by fewer reviewers than the review target. Left unmarked. */
  tooFewReads: string[];
  /** No reviews yet. Left unmarked. */
  unscored: string[];
};

/**
 * Which applications "Apply cutoff" marks, and which it skips.
 *
 * Only `submitted` applications in scope are touched: never drafts (a
 * revising hacker mid-edit) and never released decisions. A score counts only
 * once it has the full review target of reads. Under-18s are the exception:
 * they're rejected on eligibility, not score, so they're marked however many
 * reads they have.
 */
export function planCutoff(
  rows: CutoffRow[],
  { threshold, readsTarget, scope }: { threshold: number; readsTarget: number; scope: Scope },
): CutoffPlan {
  const plan: CutoffPlan = { accepted: [], rejected: [], tooFewReads: [], unscored: [] };
  for (const r of rows) {
    if (r.stage !== "submitted" || !inScope(r.priority, scope)) continue;
    const o = outcome(r, threshold);
    if (r.under18) plan.rejected.push(r.id);
    else if (o === "unscored") plan.unscored.push(r.id);
    else if (r.reads < readsTarget) plan.tooFewReads.push(r.id);
    else plan[o].push(r.id);
  }
  return plan;
}

export type ReleaseRow = { id: string; decision: string | null; priority: boolean };

/** Unreleased decisions a release in this scope publishes (rows are already unreleased). */
export function planRelease(rows: ReleaseRow[], scope: Scope): { accepted: string[]; rejected: string[] } {
  const plan = { accepted: [] as string[], rejected: [] as string[] };
  for (const r of rows) {
    if (!inScope(r.priority, scope)) continue;
    if (r.decision === "accepted" || r.decision === "rejected") plan[r.decision].push(r.id);
  }
  return plan;
}
