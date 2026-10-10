import Link from "next/link";
import type { CSSProperties } from "react";
import { DeclineSpot } from "@/components/rsvp-actions";
import { reviseApplication } from "@/lib/actions/decision";

type Rsvp = "pending" | "confirmed" | "declined" | "expired";

/** What the hacker sees: the decision, folded together with where their RSVP stands. */
type View = "invited" | "confirmed" | "declined" | "rsvp-closed" | "rejected" | "under-18";

export type DecisionCardProps = {
  firstName: string;
  decision: "accepted" | "rejected";
  rsvp: Rsvp | null;
  rsvpDeadline: Date | null;
  under18: boolean;
  /** Applications still open, so a rejected hacker can revise and resubmit. */
  canRevise: boolean;
  closeLabel: string;
};

const isAhead = (d: Date | null) => d !== null && d.getTime() > Date.now();

function viewFor({ decision, rsvp, rsvpDeadline, under18 }: DecisionCardProps): View {
  if (decision === "rejected") return under18 ? "under-18" : "rejected";
  if (rsvp === "declined") return "declined";
  // A confirmed spot stays confirmed past the deadline; only an unanswered invite closes.
  if (rsvp === "confirmed") return "confirmed";
  return rsvp === "pending" && isAhead(rsvpDeadline) ? "invited" : "rsvp-closed";
}

const formatDeadline = (d: Date) =>
  d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });

const formatDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" });

const ACCENT: Record<View, string> = {
  invited: "var(--color-cyan)",
  confirmed: "var(--color-ok)",
  declined: "var(--color-muted)",
  "rsvp-closed": "var(--color-muted)",
  rejected: "var(--color-nebula)",
  "under-18": "var(--color-nebula)",
};

const mailto = (
  <a href="mailto:admin@stanfordxr.org" className="text-cyan underline-offset-2 hover:underline">
    admin@stanfordxr.org
  </a>
);

/**
 * The applicant dashboard's main card once their decision is released,
 * replacing the "your application is in" card.
 */
export function DecisionCard(props: DecisionCardProps) {
  const { firstName, rsvpDeadline, canRevise, closeLabel } = props;
  const view = viewFor(props);
  const accent = ACCENT[view];
  const celebrate = view === "invited" || view === "confirmed";
  const rsvpStillOpen = isAhead(rsvpDeadline);

  return (
    <section className="card overflow-hidden">
      {view === "invited" && <Confetti />}
      <div
        className="p-6 sm:p-8"
        style={{
          background: celebrate
            ? "radial-gradient(42rem 18rem at 15% -40%, color-mix(in oklab, var(--color-cyan) 20%, transparent), transparent 70%), radial-gradient(36rem 16rem at 100% 0%, color-mix(in oklab, var(--color-magenta) 16%, transparent), transparent 70%)"
            : `radial-gradient(40rem 14rem at 50% -60%, color-mix(in oklab, ${accent} 12%, transparent), transparent 70%)`,
        }}
      >
        <p
          className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          Application status
        </p>

        {view === "invited" && rsvpDeadline && (
          <>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              You&apos;re in, {firstName}.
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-moonlit/90">
              Congratulations! You&apos;ve been accepted to <strong>Immerse the Bay 2026</strong>,
              November 13–15 at Stanford. Confirm your spot to let us know you&apos;re coming.
            </p>
            <p className="mt-4 text-[14px] text-muted">
              RSVP by <span className="font-semibold text-moonlit">{formatDeadline(rsvpDeadline)}</span>.
            </p>
            <div className="mt-6 flex flex-wrap items-start gap-3">
              <Link href="/rsvp" className="btn-primary">
                Confirm my spot
              </Link>
              <DeclineSpot />
            </div>
          </>
        )}

        {view === "confirmed" && (
          <>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              You&apos;re confirmed. See you there!
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-moonlit/90">
              Your spot at Immerse the Bay 2026 is locked in. Arrive before the opening ceremony
              at 7pm on Friday, November 13. We&apos;ll email check-in details, the schedule,
              and what to bring closer to the event.
            </p>
            {rsvpStillOpen && (
              <div className="mt-6 flex flex-col gap-3">
                <Link href="/rsvp" className="btn-ghost self-start !py-2 text-[14px]">
                  Edit my details
                </Link>
                <DeclineSpot subtle />
              </div>
            )}
          </>
        )}

        {view === "declined" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Thanks for letting us know</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              You&apos;ve declined your spot at Immerse the Bay 2026. We hope to see you at a future
              Stanford XR event.
            </p>
          </>
        )}

        {view === "rsvp-closed" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Your RSVP has closed</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              The RSVP deadline was {rsvpDeadline ? formatDay(rsvpDeadline) : "last week"}. If
              you&apos;d still like to attend Immerse the Bay, email {mailto}.
            </p>
          </>
        )}

        {view === "rejected" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Thank you for applying</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              Hi {firstName}, we read every application, and we had far more strong applicants than
              we have room for. Unfortunately we&apos;re not able to offer you a spot right now.
            </p>
            {canRevise ? (
              <>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
                  You&apos;re welcome to revise your application and resubmit it by{" "}
                  <span className="font-semibold text-moonlit">{closeLabel}</span>. A resubmitted
                  application goes back into review as a fresh read.
                </p>
                <form action={reviseApplication} className="mt-6">
                  <button type="submit" className="btn-primary">
                    Revise my application
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
                Please don&apos;t let this stop you: we&apos;d love to see you at other Stanford XR
                events, and to read your application next year.
              </p>
            )}
          </>
        )}

        {view === "under-18" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Thank you for applying</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              Hi {firstName}, thank you for your interest in Immerse the Bay. Stanford policy
              requires every participant to be 18 or older on the first day of the event, so
              we&apos;re unable to offer you a spot this year. We&apos;d love to have you apply
              again once you turn 18. Questions? Email {mailto}.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

type WithCssVars = CSSProperties & Record<`--${string}`, string>;

const CONFETTI_COLORS = ["#6ee8f7", "#e263f0", "#8b5cf6", "#4ade80", "#ece7fb"];

/** A one-shot CSS confetti burst over the page while an invite is open. */
function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 70 }, (_, i) => {
        const style: WithCssVars = {
          left: `${(i * 37) % 100}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${(i % 10) * 0.08}s`,
          animationDuration: `${2.2 + (i % 7) * 0.25}s`,
          "--drift": `${((i * 53) % 160) - 80}px`,
        };
        return (
          <span
            key={i}
            className="confetti-piece absolute top-[-12px] block h-2.5 w-1.5 rounded-[1px]"
            style={style}
          />
        );
      })}
    </div>
  );
}
