import Link from "next/link";
import { Brand } from "@/components/brand";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { getRole, requireUser } from "@/lib/dal";
import { closeDateLabel, finalDecisionsLabel } from "@/lib/config";
import { draftSchema, STEPS, stepStatus } from "@/lib/form-schema";
import { ensureReferralCode, getLeaderboard } from "@/lib/referral";
import { ReferralCard } from "@/components/referral-card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireUser();
  const role = await getRole();
  const { submitted: justSubmitted } = await searchParams;

  const [row] = await db
    .select({
      answers: application.answers,
      submittedAt: application.submittedAt,
      firstName: application.firstName,
      referralAnonymous: application.referralAnonymous,
    })
    .from(application)
    .where(eq(application.userId, user.id))
    .limit(1);

  // Referral machinery exists only after submission. ensureReferralCode also
  // lazily backfills applications submitted before the feature shipped.
  const referralCode = row?.submittedAt
    ? await ensureReferralCode(user.id)
    : null;
  const leaderboard = referralCode ? await getLeaderboard(referralCode) : null;
  const portalBase =
    process.env.BETTER_AUTH_URL ?? "https://portal.immersethebay.org";

  const parsed = draftSchema.safeParse(row?.answers ?? {});
  const answers = parsed.success ? parsed.data : {};
  const progress = stepStatus(answers);
  const completeSteps = progress.filter(Boolean).length;
  const firstName =
    row?.firstName || user.name?.split(" ")[0] || "hacker";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
        <div className="flex items-center gap-2">
          {(role === "admin" || role === "reviewer") && (
            <Link href="/admin" className="btn-ghost !py-2 text-[14px]">
              {role === "admin" ? "Admin" : "Review"}
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              const { auth } = await import("@/lib/auth");
              const { headers } = await import("next/headers");
              const { redirect } = await import("next/navigation");
              await auth.api.signOut({ headers: await headers() });
              redirect("/");
            }}
          >
            <button type="submit" className="btn-ghost !py-2 text-[14px]">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 pb-20 pt-4">
        <div>
          <p className="eyebrow mb-2">Dashboard</p>
          <h1 className="font-display text-3xl font-bold">
            Hey, {firstName}.
          </h1>
        </div>

        {row?.submittedAt ? (
          <section className="card overflow-hidden">
            <div
              className="border-b border-line p-6 sm:p-8"
              style={{
                background:
                  "radial-gradient(40rem 14rem at 50% -60%, color-mix(in oklab, var(--color-cyan) 14%, transparent), transparent 70%)",
              }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    {justSubmitted
                      ? "Application submitted — see you in November!"
                      : "Application submitted"}
                  </h2>
                  <p className="mt-1 text-[14px] text-muted">
                    Received{" "}
                    {row.submittedAt.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      timeZone: "America/Los_Angeles",
                    })}
                    . You can{" "}
                    <Link
                      href="/apply"
                      className="text-cyan underline-offset-2 hover:underline"
                    >
                      edit your answers
                    </Link>{" "}
                    until applications close ({closeDateLabel()}).
                  </p>
                </div>
              </div>
            </div>
            <ol className="grid gap-0 p-2 sm:grid-cols-3">
              {(
                [
                  ["Submitted", "Done ✓", true],
                  ["In review", "Through October", false],
                  ["Decision", `By ${finalDecisionsLabel()}, by email`, false],
                ] as const
              ).map(([title, when, done]) => (
                <li key={title} className="flex items-center gap-3 p-4">
                  <span
                    className={`size-2 rounded-full ${
                      done ? "bg-ok" : "bg-line-2"
                    }`}
                    aria-hidden
                  />
                  <div>
                    <p className="text-[14px] font-medium">{title}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                      {when}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {row ? "Pick up where you left off" : "Start your application"}
                </h2>
                <p className="mt-1 text-[14px] text-muted">
                  {row
                    ? `${completeSteps} of 4 stages complete — your draft is saved.`
                    : `About ten minutes, autosaved as you go. Closes ${closeDateLabel()}.`}
                </p>
              </div>
              <Link href="/apply" className="btn-primary">
                {row ? "Continue →" : "Begin →"}
              </Link>
            </div>
            {row && (
              <div className="mt-6 flex items-center gap-4">
                {STEPS.slice(0, 4).map((s, i) => (
                  <div key={s.id} className="flex flex-1 flex-col gap-1.5">
                    <span
                      aria-hidden
                      className="block h-1 rounded-full"
                      style={{
                        background: progress[i]
                          ? "color-mix(in oklab, var(--color-cyan) 55%, var(--color-line))"
                          : "var(--color-line)",
                      }}
                    />
                    <span
                      className={`hidden text-[12.5px] sm:inline ${
                        progress[i] ? "text-muted" : "text-faint"
                      }`}
                    >
                      {s.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {referralCode && leaderboard && (
          <ReferralCard
            code={referralCode}
            anonymous={row?.referralAnonymous ?? false}
            top={leaderboard.top}
            you={leaderboard.you}
            baseUrl={portalBase}
          />
        )}

        <section className="card p-6">
          <h3 className="font-display text-[15px] font-semibold">
            The event
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            November 13–15, 2026 at Stanford. 36 hours, XR hardware for every
            team, workshops, mentors, and ~$30k in prizes. Questions? Write to{" "}
            <a
              href="mailto:admin@stanfordxr.org"
              className="text-cyan underline-offset-2 hover:underline"
            >
              admin@stanfordxr.org
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
