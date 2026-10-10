import { writeFileSync } from "node:fs";
import { toCsv } from "../lib/csv";
import { getReviewResults } from "../lib/db/review-sql";
import { outcome } from "../lib/review";
import { inScope, isScope } from "../lib/rounds";

const threshold = Number(process.argv[2] ?? "3");
const requestedScope = process.argv[3] ?? "priority";
const output = process.argv[4];

if (!Number.isFinite(threshold) || threshold < 1 || threshold > 5) {
  throw new Error("Threshold must be a score between 1 and 5.");
}
if (!isScope(requestedScope)) throw new Error("Scope must be priority or all.");
if (!output) throw new Error("Usage: bun scripts/export-decisions.ts <threshold> <scope> <output.csv>");

const rows = (await getReviewResults())
  .filter((row) => inScope(row.priority, requestedScope))
  .map((row) => ({ ...row, outcome: outcome(row, threshold) }));
const order = { accepted: 0, rejected: 1, unscored: 2 } as const;
rows.sort((a, b) => order[a.outcome] - order[b.outcome]);

const header = [
  "outcome", "decision", "released", "score", "reads", "spread", "first_name",
  "last_name", "email", "school", "age_at_event", "under_18", "submitted_at",
  "reviewer_comments",
];
const csv = toCsv(
  header,
  rows.map((row) => [
    row.outcome,
    row.decision,
    row.released ? "yes" : "no",
    row.score?.toFixed(3),
    row.reads,
    row.spread?.toFixed(3),
    row.firstName,
    row.lastName,
    row.email,
    row.schoolName,
    row.age,
    row.under18 ? "yes" : "no",
    row.submittedAt?.toISOString(),
    row.comments.join(" | "),
  ]),
);

writeFileSync(output, `${csv}\n`, { mode: 0o600 });
console.log(`Wrote ${rows.length} ${requestedScope} decision rows to ${output}.`);
process.exit(0);
