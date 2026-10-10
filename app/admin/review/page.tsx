import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { ReadsPerApplication, ReleasePanel, ThresholdPanel, type UnreleasedCounts } from "@/components/review-admin";
import { getReadsPerApplication, getReviewResults } from "@/lib/db/review-sql";
import { requireAdmin } from "@/lib/dal";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { unreleasedDecision } from "@/lib/db/applicant-filter";

export const metadata: Metadata = { title: "Scores" };

/** Review results: queue settings, the acceptance cutoff, and the ranked list. */
export default async function AdminReviewPage() {
  await requireAdmin();
  const [reads, results, unreleased] = await Promise.all([
    getReadsPerApplication(),
    getReviewResults(),
    db
      .select({ decision: application.decision, n: sql<number>`count(*)::int` })
      .from(application)
      .where(unreleasedDecision)
      .groupBy(application.decision),
  ]);
  const unreleasedCounts: UnreleasedCounts = { accepted: 0, rejected: 0 };
  for (const { decision, n } of unreleased) {
    if (decision === "accepted" || decision === "rejected") unreleasedCounts[decision] = n;
  }

  const complete = results.filter((r) => r.reads >= reads).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ SCORES" />
        <div className="flex items-center gap-2">
          <Link href="/review" className="btn-ghost !py-2 text-[14px]">
            Review
          </Link>
          <Link href="/admin" className="btn-ghost !py-2 text-[14px]">
            ← Admin
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-6 pb-20 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Scores</h1>
            <p className="mt-1 text-[14px] text-muted">
              {complete} of {results.length} submitted application
              {results.length === 1 ? "" : "s"} fully reviewed.
            </p>
          </div>
          <ReadsPerApplication initial={reads} />
        </div>

        <ReleasePanel counts={unreleasedCounts} />

        <ThresholdPanel
          reads={reads}
          rows={results.map((r) => ({
            id: r.id,
            name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "(no name)",
            score: r.score,
            spread: r.spread,
            reads: r.reads,
            under18: r.under18,
            released: r.released,
          }))}
        />
      </div>
    </main>
  );
}
