import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { db } from "@/lib/db";
import { application, review } from "@/lib/db/schema";
import { applicantOwnedOnly } from "@/lib/db/applicant-filter";
import {
  getReadsPerApplication,
  readsDoneSql,
  readsTakenSql,
  reviewScoreSql,
} from "@/lib/db/review-sql";
import { claimNext } from "@/lib/actions/review";
import { requireReviewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Review" };

/**
 * Reviewer landing: queue progress, the button that pulls the next
 * application, and the reviewer's own past reviews (blind — no names).
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  const { user, role } = await requireReviewer();
  const { empty } = await searchParams;
  const reads = await getReadsPerApplication();

  const [[queue], [openClaim], mine] = await Promise.all([
    db
      .select({
        applications: sql<number>`count(*)::int`,
        complete: sql<number>`(count(*) filter (where ${readsDoneSql} >= ${reads}))::int`,
        remaining: sql<number>`coalesce(sum(greatest(${reads} - ${readsTakenSql}, 0)), 0)::int`,
      })
      .from(application)
      .where(and(isNotNull(application.submittedAt), applicantOwnedOnly)),
    db
      .select({ applicationId: review.applicationId })
      .from(review)
      .where(and(eq(review.reviewerId, user.id), isNull(review.submittedAt)))
      .limit(1),
    db
      .select({
        applicationId: review.applicationId,
        score: sql<number>`${reviewScoreSql}::float8`,
        submittedAt: review.submittedAt,
      })
      .from(review)
      .where(and(eq(review.reviewerId, user.id), isNotNull(review.submittedAt)))
      .orderBy(desc(review.submittedAt)),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ REVIEW" />
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <Link href="/admin/review" className="btn-ghost !py-2 text-[14px]">
              Scores
            </Link>
          )}
          <Link href="/dashboard" className="btn-ghost !py-2 text-[14px]">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 pb-20 pt-4">
        <div>
          <p className="eyebrow mb-2">Reviewer</p>
          <h1 className="font-display text-3xl font-semibold">Review queue</h1>
        </div>

        <dl className="grid grid-cols-3 gap-3">
          {(
            [
              ["You've reviewed", mine.length],
              ["Reads left", queue.remaining],
              ["Fully reviewed", `${queue.complete} / ${queue.applications}`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="card p-5">
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                {label}
              </dt>
              <dd className="font-display mt-1.5 text-3xl font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <section className="card flex flex-col items-start gap-4 p-6 sm:p-8">
          {openClaim ? (
            <>
              <p className="text-[14px] text-muted">
                You have an application open. Finish it before taking another.
              </p>
              <Link href={`/review/${openClaim.applicationId}`} className="btn-primary">
                Continue reviewing →
              </Link>
            </>
          ) : empty ? (
            <p className="text-[14px] text-muted">
              Nothing left for you right now: every application either has{" "}
              {reads} reads or you&apos;ve already read it. Check back as new
              applications come in.
            </p>
          ) : (
            <>
              <p className="max-w-prose text-[14px] leading-relaxed text-muted">
                Each application gets {reads} independent reads. You won&apos;t
                see names, schools, or anyone else&apos;s scores. Score each
                category from 1 to 5.
              </p>
              <form action={claimNext}>
                <button type="submit" className="btn-primary">
                  Start reviewing →
                </button>
              </form>
            </>
          )}
        </section>

        {mine.length > 0 && (
          <section>
            <h2 className="font-display mb-3 text-lg font-semibold">Your reviews</h2>
            <ul className="card divide-y divide-line/50">
              {mine.map((r) => (
                <li key={r.applicationId}>
                  <Link
                    href={`/review/${r.applicationId}`}
                    className="flex items-center justify-between px-5 py-3 text-[14px] hover:bg-white/[0.03]"
                  >
                    <span className="font-mono text-[13px] text-muted">
                      #{r.applicationId.slice(0, 8)}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="font-mono text-[12.5px] text-faint">
                        {r.submittedAt?.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/Los_Angeles",
                        })}
                      </span>
                      <span className="w-10 text-right tabular-nums">
                        {r.score.toFixed(2)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
