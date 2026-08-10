import Link from "next/link";
import { Brand } from "@/components/brand";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { getRole, requireUser } from "@/lib/dal";
import { closeDateLabel, finalDecisionsLabel, priorityDeadlineLabel, priorityDecisionsLabel } from "@/lib/config";
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
              className="flex items-start gap-4 border-b border-line p-6 sm:p-8"
              style={{
                background:
                  "radial-gradient(40rem 14rem at 50% -60%, color-mix(in oklab, var(--color-cyan) 14%, transparent), transparent 70%)",
              }}
            >
              <span
                aria-hidden
                className="mt-0.5 flex size-11 flex-none items-center justify-center rounded-full text-[20px]"
                style={{
                  background: "color-mix(in oklab, var(--color-ok) 18%, var(--color-abyss))",
                  border: "2px solid var(--color-ok)",
                  color: "var(--color-ok)",
                  boxShadow: "0 0 16px color-mix(in oklab, var(--color-ok) 35%, transparent)",
                }}
              >
                ✓
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {justSubmitted
                    ? "Application submitted — see you in November!"
                    : "Your application is in"}
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

            {/* connected progress rail: where your application is in the process */}
            <div className="p-6 sm:p-7">
              <ol className="relative flex">
                {(
                  [
                    ["Submitted", "Done ✓", "done"],
                    ["In review", "Through October", "future"],
                    ["Decision", `By ${finalDecisionsLabel()}, by email`, "future"],
                  ] as const
                ).map(([title, when, state], i, all) => (
                  <li key={title} className="relative flex-1">
                    <div className="flex items-center">
                      <span
                        aria-hidden
                        className={`h-[3px] flex-1 ${i === 0 ? "opacity-0" : ""}`}
                        style={{
                          background:
                            all[i - 1]?.[2] === "done"
                              ? "linear-gradient(90deg, var(--color-ok), var(--color-line-2))"
                              : "var(--color-line)",
                        }}
                      />
                      <span
                        aria-hidden
                        className="flex size-7 flex-none items-center justify-center rounded-full text-[12px] font-bold"
                        style={{
                          background:
                            state === "done"
                              ? "var(--color-ok)"
                              : "var(--color-surface-2)",
                          border: `2px solid ${
                            state === "done" ? "var(--color-ok)" : "var(--color-line-2)"
                          }`,
                          color: state === "done" ? "#06281c" : "var(--color-faint)",
                          boxShadow:
                            state === "done"
                              ? "0 0 10px color-mix(in oklab, var(--color-ok) 40%, transparent)"
                              : undefined,
                        }}
                      >
                        {state === "done" ? "✓" : i + 1}
                      </span>
                      <span
                        aria-hidden
                        className={`h-[3px] flex-1 ${i === all.length - 1 ? "opacity-0" : ""}`}
                        style={{
                          background:
                            state === "done"
                              ? "linear-gradient(90deg, var(--color-ok), var(--color-line))"
                              : "var(--color-line)",
                        }}
                      />
                    </div>
                    <div className="mt-2.5 text-center">
                      <p
                        className={`text-[14px] font-semibold ${
                          state === "done" ? "text-moonlit" : "text-muted"
                        }`}
                      >
                        {title}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                        {when}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
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
          <h3 className="font-display mb-3 text-[15px] font-semibold">
            Details
          </h3>
          <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[11rem_1fr]">
            <dt className="text-faint">Event</dt>
            <dd className="text-moonlit/90">
              November 13–15, 2026 · Stanford University
            </dd>
            <dt className="text-faint">Priority deadline</dt>
            <dd className="text-moonlit/90">
              {priorityDeadlineLabel()}, decisions by {priorityDecisionsLabel()}
            </dd>
            <dt className="text-faint">Final deadline</dt>
            <dd className="text-moonlit/90">
              {closeDateLabel()}, decisions by {finalDecisionsLabel()}
            </dd>
            <dt className="text-faint">Decisions sent from</dt>
            <dd className="text-moonlit/90">apply@immersethebay.org</dd>
            <dt className="text-faint">Questions</dt>
            <dd>
              <a
                href="mailto:admin@stanfordxr.org"
                className="text-cyan underline-offset-2 hover:underline"
              >
                admin@stanfordxr.org
              </a>
            </dd>
          </dl>
        </section>
      </div>
    </main>
  );
}
