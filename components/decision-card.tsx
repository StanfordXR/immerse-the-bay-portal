import { RsvpActions } from "@/components/rsvp-actions";

type Decision = "accepted" | "waitlisted" | "rejected";
type Rsvp = "pending" | "confirmed" | "declined" | "expired";

/** What the hacker sees: the decision, folded together with where their RSVP stands. */
type View = "invited" | "confirmed" | "declined" | "rsvp-closed" | "waitlisted" | "rejected";

function viewFor(decision: Decision, rsvp: Rsvp | null, deadline: Date | null): View {
  if (decision !== "accepted") return decision;
  if (rsvp === "confirmed") return "confirmed";
  if (rsvp === "declined") return "declined";
  const open = rsvp === "pending" && deadline !== null && deadline.getTime() > Date.now();
  return open ? "invited" : "rsvp-closed";
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

const ACCENT: Record<View, string> = {
  invited: "var(--color-cyan)",
  confirmed: "var(--color-ok)",
  declined: "var(--color-muted)",
  "rsvp-closed": "var(--color-muted)",
  waitlisted: "var(--color-violet)",
  rejected: "var(--color-nebula)",
};

/**
 * The applicant dashboard's main card once their decision is released,
 * replacing the "your application is in" card. RSVP happens right here.
 */
export function DecisionCard({
  firstName,
  decision,
  rsvp,
  rsvpDeadline,
}: {
  firstName: string;
  decision: Decision;
  rsvp: Rsvp | null;
  rsvpDeadline: Date | null;
}) {
  const view = viewFor(decision, rsvp, rsvpDeadline);
  const accent = ACCENT[view];
  const celebrate = view === "invited" || view === "confirmed";

  return (
    <section className="card overflow-hidden">
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
              November 13–15 at Stanford. Spots are limited, so let us know if you can make it.
            </p>
            <p className="mt-4 text-[14px] text-muted">
              RSVP by{" "}
              <span className="font-semibold text-moonlit">{formatDeadline(rsvpDeadline)}</span>.
              Unconfirmed spots go to the waitlist after that.
            </p>
            <div className="mt-6">
              <RsvpActions />
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
            <div className="mt-6">
              <RsvpActions confirmed />
            </div>
          </>
        )}

        {view === "declined" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Thanks for letting us know</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              You&apos;ve declined your spot at Immerse the Bay 2026, and it&apos;s gone to someone
              on the waitlist. We hope to see you at a future Stanford XR event.
            </p>
          </>
        )}

        {view === "rsvp-closed" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Your RSVP window has closed</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              You were accepted, but we didn&apos;t hear back before the deadline, so your spot
              was released to the waitlist. If you think this is a mistake, email{" "}
              <a href="mailto:admin@stanfordxr.org" className="text-cyan underline-offset-2 hover:underline">
                admin@stanfordxr.org
              </a>
              .
            </p>
          </>
        )}

        {view === "waitlisted" && (
          <>
            <h2 className="font-display text-2xl font-semibold">You&apos;re on the waitlist</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              Thanks for applying, {firstName}. We had far more strong applications than spots,
              and we&apos;d love to make room for you. Spots open up as accepted hackers decline,
              and if one opens for you we&apos;ll email you and it will show up right here.
            </p>
          </>
        )}

        {view === "rejected" && (
          <>
            <h2 className="font-display text-2xl font-semibold">Thank you for applying</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              Hi {firstName}, we read every application, and this year we had far more strong
              applicants than we have room for. Unfortunately we&apos;re not able to offer you a
              spot at Immerse the Bay 2026. Please don&apos;t let this stop you: we&apos;d love to
              see you apply again, and at other Stanford XR events in the meantime.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
