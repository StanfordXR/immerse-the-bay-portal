import type { NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/dal";
import { toCsv } from "@/lib/csv";
import { getReviewResults } from "@/lib/db/review-sql";
import { outcome } from "@/lib/review";
import { inScope, isScope } from "@/lib/rounds";

/**
 * Decisions CSV at a score cutoff (`?min=3.25`), one row per submitted
 * application. This is what goes to whoever sends decision emails: send from
 * the `decision` column once released. Rejected rows carry reviewer comments
 * for the spot-check pass.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return new Response("Forbidden", { status: 403 });

  const threshold = Number(req.nextUrl.searchParams.get("min"));
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 5) {
    return new Response("?min must be a score between 1 and 5", { status: 400 });
  }
  const requestedScope = req.nextUrl.searchParams.get("scope") ?? "priority";
  if (!isScope(requestedScope)) return new Response("?scope must be priority or all", { status: 400 });

  const rows = (await getReviewResults())
    .filter((r) => inScope(r.priority, requestedScope))
    .map((r) => ({ ...r, outcome: outcome(r, threshold) }));
  const order = { accepted: 0, rejected: 1, unscored: 2 } as const;
  rows.sort((a, b) => order[a.outcome] - order[b.outcome]);

  // `outcome` is the score at this cutoff; `decision` is what's actually
  // marked (hand edits included) and whether hackers can see it yet.
  const header = [
    "outcome", "decision", "released", "score", "reads", "spread", "first_name",
    "last_name", "email", "school", "age_at_event", "under_18", "submitted_at",
    "reviewer_comments",
  ];
  const csv = toCsv(
    header,
    rows.map((r) => [
      r.outcome, r.decision, r.released ? "yes" : "no", r.score?.toFixed(3), r.reads,
      r.spread?.toFixed(3), r.firstName, r.lastName, r.email, r.schoolName, r.age,
      r.under18 ? "yes" : "no", r.submittedAt?.toISOString(), r.comments.join(" | "),
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="itb-2026-${requestedScope}-decisions-min${threshold.toFixed(2)}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
