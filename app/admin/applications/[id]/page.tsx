import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { DecisionPanel, TagToggles } from "@/components/application-admin-panel";
import { db } from "@/lib/db";
import {
  application,
  applicationEvent,
  applicationTag,
  tag,
  user,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/dal";
import { draftSchema } from "@/lib/form-schema";

export const metadata: Metadata = { title: "Application" };

/** Age on the event's first day, the eligibility rule (18+ on Nov 13, 2026). */
function ageAtEvent(dob: string | null): number | null {
  if (!dob) return null;
  const event = new Date("2026-11-13T00:00:00");
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = event.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    event.getMonth() < birth.getMonth() ||
    (event.getMonth() === birth.getMonth() && event.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default async function AdminApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [row] = await db
    .select()
    .from(application)
    .where(eq(application.id, id))
    .limit(1);
  if (!row) notFound();

  const [account] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);

  const [allTags, appliedTags, events] = await Promise.all([
    db
      .select({ id: tag.id, name: tag.name })
      .from(tag)
      .where(eq(tag.archived, false))
      .orderBy(tag.name),
    db
      .select({ tagId: applicationTag.tagId })
      .from(applicationTag)
      .where(eq(applicationTag.applicationId, id)),
    db
      .select({
        kind: applicationEvent.kind,
        actorKind: applicationEvent.actorKind,
        payload: applicationEvent.payload,
        at: applicationEvent.at,
      })
      .from(applicationEvent)
      .where(eq(applicationEvent.applicationId, id))
      .orderBy(desc(applicationEvent.at))
      .limit(30),
  ]);

  const parsed = draftSchema.safeParse(row.answers ?? {});
  const answers = parsed.success ? parsed.data : ({} as Record<string, never>);
  const age = ageAtEvent(row.dateOfBirth);
  const fullName =
    [row.firstName, row.lastName].filter(Boolean).join(" ") || "(no name yet)";

  const fmt = (d: Date | null) =>
    d?.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    }) ?? "·";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ APPLICATION" />
        <Link href="/admin/applications" className="btn-ghost !py-2 text-[14px]">
          ← All applications
        </Link>
      </header>

      <div className="flex flex-col gap-6 pb-20 pt-2">
        {/* header */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold">{fullName}</h1>
            {row.submittedAt ? (
              <span className="rounded-full border border-ok/50 px-2.5 py-0.5 text-[12px] text-ok">
                submitted {fmt(row.submittedAt)}
              </span>
            ) : (
              <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-[12px] text-muted">
                draft
              </span>
            )}
            {age !== null && age < 18 && (
              <span className="rounded-full border border-danger/60 px-2.5 py-0.5 text-[12px] font-medium text-danger">
                under 18 at event ({age})
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[13px] text-faint">
            {account?.email ?? "unknown"}
            {answers.pronouns
              ? ` · ${answers.pronouns === "self-describe" ? answers.pronounsSelf : answers.pronouns}`
              : ""}
            {age !== null ? ` · ${age} at event` : ""}
          </p>
        </div>

        {/* tags + decision */}
        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-3 text-[15px] font-semibold">Tags</h2>
          <TagToggles
            applicationId={id}
            allTags={allTags}
            applied={appliedTags.map((t) => t.tagId)}
          />
          <h2 className="font-display mb-3 mt-7 text-[15px] font-semibold">
            Decision
          </h2>
          <DecisionPanel
            applicationId={id}
            initialDecision={row.decision}
            initialNote={row.decisionNote ?? ""}
          />
        </section>

        {/* background */}
        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-4 text-[15px] font-semibold">
            Background
          </h2>
          <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[11rem_minmax(0,1fr)] [&_dd]:min-w-0 [&_dd]:break-words">
            <dt className="text-faint">School</dt>
            <dd className="text-moonlit/90">
              {row.schoolName || "·"}
              {row.schoolRegion ? `, ${row.schoolRegion}` : ""}
              {row.schoolCountry ? ` (${row.schoolCountry})` : ""}
            </dd>
            <dt className="text-faint">Graduation</dt>
            <dd className="text-moonlit/90">{row.gradYear ?? "·"}</dd>
            <dt className="text-faint">Hackathons</dt>
            <dd className="text-moonlit/90">
              {row.hackathonsBucket ?? "·"}
              {row.firstHackathon ? " · first hackathon" : ""}
            </dd>
            <dt className="text-faint">ITBs attended</dt>
            <dd className="text-moonlit/90">{row.priorAttendance ?? "·"}</dd>
            <dt className="text-faint">Primary skill</dt>
            <dd className="text-moonlit/90">{row.primarySkill ?? "·"}</dd>
            <dt className="text-faint">Skills</dt>
            <dd className="text-moonlit/90">
              {[...(answers.skills ?? []), answers.skillsOther]
                .filter(Boolean)
                .join(", ") || "·"}
            </dd>
            <dt className="text-faint">Links</dt>
            <dd className="break-words text-moonlit/90">{row.portfolioUrl || "·"}</dd>
            <dt className="text-faint">Resume</dt>
            <dd>
              {row.resumeUrl ? (
                <a
                  href={row.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan underline-offset-2 hover:underline"
                >
                  Open resume ↗
                </a>
              ) : (
                "·"
              )}
              {row.sponsorShareOk ? (
                <span className="ml-2 text-[12.5px] text-ok">sponsor share OK</span>
              ) : (
                <span className="ml-2 text-[12.5px] text-faint">no sponsor share</span>
              )}
            </dd>
          </dl>
        </section>

        {/* story */}
        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-4 text-[15px] font-semibold">Story</h2>
          <h3 className="text-[13px] font-medium text-faint">
            Why do you want to be part of Immerse the Bay?
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-moonlit/90 [overflow-wrap:anywhere]">
            {answers.whyParticipate || "·"}
          </p>
          <h3 className="mt-5 text-[13px] font-medium text-faint">
            CEO question
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-moonlit/90 [overflow-wrap:anywhere]">
            {answers.ceoQuestion || "·"}
          </p>
        </section>

        {/* logistics + attribution */}
        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-4 text-[15px] font-semibold">
            Logistics and attribution
          </h2>
          <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[11rem_minmax(0,1fr)] [&_dd]:min-w-0 [&_dd]:break-words">
            <dt className="text-faint">T-shirt</dt>
            <dd className="text-moonlit/90">{row.tshirtSize ?? "·"}</dd>
            <dt className="text-faint">Dietary</dt>
            <dd className="text-moonlit/90">{row.dietaryNeeds || "·"}</dd>
            <dt className="text-faint">Accessibility</dt>
            <dd className="text-moonlit/90">{row.accessibilityNeeds || "·"}</dd>
            <dt className="text-faint">Heard about us</dt>
            <dd className="text-moonlit/90">
              {row.heardAboutUs || "·"}
              {row.heardAboutUsName ? ` · via ${row.heardAboutUsName}` : ""}
            </dd>
            <dt className="text-faint">First touch</dt>
            <dd className="font-mono text-[13px] text-moonlit/90">
              {row.utmSource
                ? [row.utmSource, row.utmContent].filter(Boolean).join(" / ")
                : "direct or unknown"}
              {row.landingPath ? ` → ${row.landingPath}` : ""}
            </dd>
            <dt className="text-faint">Referral code</dt>
            <dd className="font-mono text-[13px] text-moonlit/90">
              {row.referralCode ?? "·"}
              {row.referralAnonymous ? " (anonymous)" : ""}
            </dd>
          </dl>
        </section>

        {/* audit trail */}
        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-4 text-[15px] font-semibold">
            History
          </h2>
          {events.length === 0 ? (
            <p className="text-[13.5px] text-faint">No events recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map((e, i) => (
                <li key={i} className="flex items-baseline gap-3 text-[13.5px]">
                  <span className="w-32 flex-none font-mono text-[12px] text-faint">
                    {fmt(e.at)}
                  </span>
                  <span className="text-moonlit/90">
                    {e.kind.replaceAll("_", " ")}
                    <span className="text-faint"> · {e.actorKind}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
