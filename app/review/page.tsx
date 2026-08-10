import Link from "next/link";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { requireReviewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Review" };

/**
 * Reviewer landing. Deliberately a shell: the review queue (blind two-read
 * round one, pull-queue claims, scoring) ships in September. This page exists
 * now so reviewer access is provable end to end before the tooling lands.
 */
export default async function ReviewPage() {
  const { role } = await requireReviewer();

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      submitted: sql<number>`(count(*) filter (where ${application.submittedAt} is not null))::int`,
    })
    .from(application);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ REVIEW" />
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <Link href="/admin" className="btn-ghost !py-2 text-[14px]">
              Admin
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

        <dl className="grid grid-cols-2 gap-3">
          {(
            [
              ["Submitted", counts.submitted],
              ["Drafts in flight", counts.total - counts.submitted],
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

        <section className="card p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold">
            The queue opens September 15
          </h2>
          <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-muted">
            Round one is a blind read: two reviewers score each application
            without seeing names, schools, or each other&apos;s scores.
            Applications are claimed from a shared queue, so nothing gets read
            twice or skipped. Scoring rubric and tooling land here in early
            September.
          </p>
          <p className="mt-3 text-[14px] text-muted">
            Until then, this page just confirms your reviewer access works.
            It does. 🌒
          </p>
        </section>
      </div>
    </main>
  );
}
