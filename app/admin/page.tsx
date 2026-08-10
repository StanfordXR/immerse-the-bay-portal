import Link from "next/link";
import { Brand } from "@/components/brand";
import type { Metadata } from "next";
import { desc, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, feedback, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      submitted: sql<number>`count(*) filter (where ${application.submittedAt} is not null)::int`,
      last24h: sql<number>`count(*) filter (where ${application.submittedAt} > now() - interval '24 hours')::int`,
    })
    .from(application);

  const sources = await db
    .select({
      source: sql<string>`coalesce(${application.utmSource}, 'direct / unknown')`,
      medium: sql<string>`coalesce(${application.utmMedium}, '—')`,
      total: sql<number>`count(*)::int`,
      submitted: sql<number>`count(*) filter (where ${application.submittedAt} is not null)::int`,
    })
    .from(application)
    .groupBy(application.utmSource, application.utmMedium)
    .orderBy(desc(sql`count(*)`));

  const recent = await db
    .select({
      firstName: application.firstName,
      lastName: application.lastName,
      schoolName: application.schoolName,
      primarySkill: application.primarySkill,
      utmSource: application.utmSource,
      heardAboutUs: application.heardAboutUs,
      submittedAt: application.submittedAt,
    })
    .from(application)
    .where(isNotNull(application.submittedAt))
    .orderBy(desc(application.submittedAt))
    .limit(100);

  const feedbackRows = await db
    .select({
      createdAt: feedback.createdAt,
      email: user.email,
      deviceMethod: feedback.deviceMethod,
      broke: feedback.broke,
      friction: feedback.friction,
      formNotes: feedback.formNotes,
      duration: feedback.duration,
      mobileNotes: feedback.mobileNotes,
    })
    .from(feedback)
    .leftJoin(user, sql`${user.id} = ${feedback.userId}`)
    .orderBy(desc(feedback.createdAt))
    .limit(50);

  const drafts = counts.total - counts.submitted;
  const completion =
    counts.total > 0 ? Math.round((counts.submitted / counts.total) * 100) : 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ ADMIN" />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/applications" className="btn-ghost !py-2 text-[14px]">
            Applications
          </Link>
          <Link href="/admin/users" className="btn-ghost !py-2 text-[14px]">
            Users
          </Link>
          <Link href="/admin/tags" className="btn-ghost !py-2 text-[14px]">
            Tags
          </Link>
          <Link href="/review" className="btn-ghost !py-2 text-[14px]">
            Review
          </Link>
          <a href="/admin/export" className="btn-ghost !py-2 text-[14px]">
            Export CSV ↓
          </a>
          <Link href="/dashboard" className="btn-ghost !py-2 text-[14px]">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-8 pb-20 pt-2">
        {/* stat tiles */}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Submitted", counts.submitted, "vs 436 last year"],
              ["Drafts in flight", drafts, "started, not finished"],
              ["Start → submit", `${completion}%`, "45.6% last year"],
              ["Last 24 hours", counts.last24h, "submissions"],
            ] as const
          ).map(([label, value, sub]) => (
            <div key={label} className="card p-5">
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                {label}
              </dt>
              <dd className="font-display mt-1.5 text-3xl font-semibold tabular-nums">
                {value}
              </dd>
              <p className="mt-1 text-[12px] text-faint">{sub}</p>
            </div>
          ))}
        </dl>

        {/* attribution — the question this portal exists to answer */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">
              Where applicants come from
            </h2>
            <span className="text-[12.5px] text-faint">
              first-touch attribution · self-reported cross-check in the CSV
            </span>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-140 text-[14px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Source</Th>
                  <Th>Medium</Th>
                  <Th right>Accounts</Th>
                  <Th right>Submitted</Th>
                  <Th right>Conversion</Th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-faint">
                      No applications yet — this fills in as they arrive.
                    </td>
                  </tr>
                )}
                {sources.map((s) => (
                  <tr
                    key={`${s.source}/${s.medium}`}
                    className="border-b border-line/50 last:border-0"
                  >
                    <Td>
                      <span className="font-mono text-[13px]">{s.source}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[13px] text-muted">
                        {s.medium}
                      </span>
                    </Td>
                    <Td right>{s.total}</Td>
                    <Td right>{s.submitted}</Td>
                    <Td right>
                      {s.total > 0
                        ? `${Math.round((s.submitted / s.total) * 100)}%`
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* recent submissions */}
        <section>
          <h2 className="font-display mb-3 text-lg font-semibold">
            Recent submissions
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-160 text-[14px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Name</Th>
                  <Th>School</Th>
                  <Th>Primary skill</Th>
                  <Th>Source</Th>
                  <Th right>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-faint">
                      Nothing yet. The full applicant list lives in the CSV
                      export once submissions start.
                    </td>
                  </tr>
                )}
                {recent.map((r, i) => (
                  <tr key={i} className="border-b border-line/50 last:border-0">
                    <Td>
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                    </Td>
                    <Td>
                      <span className="text-muted">{r.schoolName ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-muted">{r.primarySkill ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[13px] text-muted">
                        {r.utmSource ?? r.heardAboutUs ?? "—"}
                      </span>
                    </Td>
                    <Td right>
                      <span className="font-mono text-[12.5px] text-faint">
                        {r.submittedAt?.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/Los_Angeles",
                        })}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* stress-test feedback */}
        <section>
          <h2 className="font-display mb-3 text-lg font-semibold">
            Feedback ({feedbackRows.length})
          </h2>
          {feedbackRows.length === 0 ? (
            <p className="card p-5 text-[14px] text-faint">
              Nothing yet. Responses from portal.immersethebay.org/feedback land
              here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {feedbackRows.map((f, i) => (
                <div key={i} className="card p-5 text-[14px]">
                  <p className="mb-2 font-mono text-[12px] text-faint">
                    {f.email ?? "unknown"} ·{" "}
                    {f.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "America/Los_Angeles",
                    })}
                    {f.deviceMethod ? ` · ${f.deviceMethod}` : ""}
                    {f.duration ? ` · took ${f.duration}` : ""}
                  </p>
                  <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[9rem_1fr]">
                    {(
                      [
                        ["Broke", f.broke],
                        ["Friction", f.friction],
                        ["Other", f.formNotes],
                        ["Mobile", f.mobileNotes],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt className="text-faint">{label}</dt>
                          <dd className="whitespace-pre-wrap text-moonlit/90">
                            {value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-[13px] text-faint">
          Review tooling (two-round scoring, assignment queue, tagging) ships in
          September, before the review window opens. Until then, the CSV export
          is the escape hatch.
        </p>
      </div>
    </main>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.13em] text-faint ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-4 py-3 ${right ? "text-right tabular-nums" : ""}`}>
      {children}
    </td>
  );
}
