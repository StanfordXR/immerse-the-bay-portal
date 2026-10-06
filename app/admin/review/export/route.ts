import type { NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/dal";
import { toCsv } from "@/lib/csv";
import { getReviewResults } from "@/lib/db/review-sql";
import { outcome } from "@/lib/review";

/**
 * Decisions CSV at a score cutoff (`?min=3.25`), one row per submitted
 * application. This is what goes to whoever sends decision emails; the
 * rejected rows carry reviewer comments for the spot-check pass.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return new Response("Forbidden", { status: 403 });

  const threshold = Number(req.nextUrl.searchParams.get("min"));
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 5) {
    return new Response("?min must be a score between 1 and 5", { status: 400 });
  }

  const rows = (await getReviewResults()).map((r) => ({ ...r, outcome: outcome(r, threshold) }));
  const order = { accepted: 0, rejected: 1, unscored: 2 } as const;
  rows.sort((a, b) => order[a.outcome] - order[b.outcome]);

  const header = [
    "outcome", "score", "reads", "spread", "first_name", "last_name", "email",
    "school", "age_at_event", "under_18", "reviewer_comments",
  ];
  const csv = toCsv(
    header,
    rows.map((r) => [
      r.outcome, r.score?.toFixed(3), r.reads, r.spread?.toFixed(3),
      r.firstName, r.lastName, r.email, r.schoolName, r.age,
      r.under18 ? "yes" : "no", r.comments.join(" | "),
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="itb-2026-decisions-min${threshold.toFixed(2)}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
