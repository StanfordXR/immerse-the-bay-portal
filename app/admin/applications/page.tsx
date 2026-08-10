import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { db } from "@/lib/db";
import { application, applicationTag, tag } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Applications" };

const STATUS_OPTIONS = ["all", "submitted", "draft"] as const;
const DECISION_OPTIONS = ["any", "undecided", "accepted", "waitlisted", "rejected"] as const;

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    decision?: string;
    source?: string;
    tag?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = STATUS_OPTIONS.includes(params.status as never)
    ? (params.status as (typeof STATUS_OPTIONS)[number])
    : "submitted";
  const decision = DECISION_OPTIONS.includes(params.decision as never)
    ? (params.decision as (typeof DECISION_OPTIONS)[number])
    : "any";
  const source = (params.source ?? "").trim();
  const tagFilter = (params.tag ?? "").trim();

  const conditions: SQL[] = [];
  if (status === "submitted") conditions.push(isNotNull(application.submittedAt));
  if (status === "draft") conditions.push(isNull(application.submittedAt));
  if (decision === "undecided") conditions.push(isNull(application.decision));
  if (decision !== "any" && decision !== "undecided")
    conditions.push(eq(application.decision, decision));
  if (source) conditions.push(eq(application.utmSource, source));
  if (q) {
    const needle = `%${q}%`;
    conditions.push(
      or(
        ilike(application.firstName, needle),
        ilike(application.lastName, needle),
        ilike(application.schoolName, needle),
      )!,
    );
  }
  if (tagFilter) {
    conditions.push(
      sql`exists (select 1 from ${applicationTag} at2 where at2.application_id = ${application.id} and at2.tag_id = ${tagFilter})`,
    );
  }

  const [rows, allTags, sources] = await Promise.all([
    db
      .select({
        id: application.id,
        firstName: application.firstName,
        lastName: application.lastName,
        schoolName: application.schoolName,
        gradYear: application.gradYear,
        primarySkill: application.primarySkill,
        utmSource: application.utmSource,
        submittedAt: application.submittedAt,
        decision: application.decision,
        tags: sql<string[]>`coalesce((select array_agg(t.name order by t.name) from ${applicationTag} at3 join ${tag} t on t.id = at3.tag_id where at3.application_id = ${application.id}), '{}')`,
      })
      .from(application)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(sql`coalesce(${application.submittedAt}, ${application.updatedAt})`))
      .limit(500),
    db
      .select({ id: tag.id, name: tag.name })
      .from(tag)
      .where(eq(tag.archived, false))
      .orderBy(tag.name),
    db
      .selectDistinct({ source: application.utmSource })
      .from(application)
      .where(isNotNull(application.utmSource))
      .orderBy(application.utmSource),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ APPLICATIONS" />
        <div className="flex items-center gap-2">
          <a href="/admin/export" className="btn-ghost !py-2 text-[14px]">
            Export CSV ↓
          </a>
          <Link href="/admin" className="btn-ghost !py-2 text-[14px]">
            ← Admin
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-5 pb-20 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Applications</h1>
          <p className="mt-1 text-[14px] text-muted">
            {rows.length} matching. Click a row for the full application.
          </p>
        </div>

        {/* filters: plain GET form, no client JS needed */}
        <form
          method="get"
          className="card flex flex-wrap items-end gap-3 p-4"
          aria-label="Filters"
        >
          <label className="flex flex-col gap-1 text-[12.5px] text-faint">
            Search
            <input
              name="q"
              defaultValue={q}
              placeholder="Name or school"
              className="field !w-48 !py-2 !text-[14px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] text-faint">
            Status
            <select name="status" defaultValue={status} className="field !w-32 !py-2 !text-[14px]">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] text-faint">
            Decision
            <select name="decision" defaultValue={decision} className="field !w-36 !py-2 !text-[14px]">
              {DECISION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] text-faint">
            Source
            <select name="source" defaultValue={source} className="field !w-32 !py-2 !text-[14px]">
              <option value="">any</option>
              {sources.map((s) =>
                s.source ? (
                  <option key={s.source} value={s.source}>
                    {s.source}
                  </option>
                ) : null,
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] text-faint">
            Tag
            <select name="tag" defaultValue={tagFilter} className="field !w-36 !py-2 !text-[14px]">
              <option value="">any</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-ghost !py-2 !text-[14px]">
            Apply
          </button>
        </form>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-180 text-[14px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Applicant", "School", "Skill", "Source", "Submitted", "Decision", "Tags"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-faint">
                    Nothing matches these filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-surface-2/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/applications/${r.id}`}
                      className="font-medium text-moonlit/95 underline-offset-2 hover:text-cyan hover:underline"
                    >
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "(no name yet)"}
                    </Link>
                  </td>
                  <td className="max-w-52 truncate px-4 py-3 text-muted">
                    {r.schoolName || "·"}
                    {r.gradYear ? ` '${String(r.gradYear).slice(2)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.primarySkill || "·"}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {r.utmSource || "·"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {r.submittedAt
                      ? r.submittedAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/Los_Angeles",
                        })
                      : "draft"}
                  </td>
                  <td className="px-4 py-3">
                    {r.decision ? (
                      <span
                        className={
                          r.decision === "accepted"
                            ? "text-ok"
                            : r.decision === "rejected"
                              ? "text-danger"
                              : "text-muted"
                        }
                      >
                        {r.decision}
                      </span>
                    ) : (
                      <span className="text-faint">·</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-line-2 px-2 py-0.5 text-[11.5px] text-muted"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
