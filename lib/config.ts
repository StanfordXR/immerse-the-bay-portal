/** Event configuration, derived from env with sane fallbacks. */

export const EVENT_START = new Date(
  process.env.NEXT_PUBLIC_EVENT_START ?? "2026-11-13",
);

/** Priority-round deadline — earlier applications land in the first decision wave. */
export function priorityDeadline(): Date | null {
  const raw = process.env.NEXT_PUBLIC_PRIORITY_DEADLINE;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function priorityDeadlineLabel(): string {
  const d = priorityDeadline();
  if (!d) return "TBA";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

export function applicationsClose(): Date | null {
  const raw = process.env.NEXT_PUBLIC_APPLICATIONS_CLOSE;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function applicationsAreClosed(): boolean {
  const close = applicationsClose();
  return close !== null && Date.now() > close.getTime();
}

/** True while the priority round is still ahead; deadline copy pivots on it. */
export function priorityRoundOpen(): boolean {
  const cutoff = priorityDeadline();
  return cutoff !== null && Date.now() < cutoff.getTime();
}

export function closeDateLabel(): string {
  const close = applicationsClose();
  if (!close) return "TBA";
  return close.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function plusOneWeekLabel(date: Date | null): string {
  if (!date) return "TBA";
  const d = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

/** Decisions land one week after each round closes — derived, so an extension moves them automatically. */
export function priorityDecisionsLabel(): string {
  return plusOneWeekLabel(priorityDeadline());
}

export function finalDecisionsLabel(): string {
  return plusOneWeekLabel(applicationsClose());
}

/**
 * Age on the event's first day — the eligibility rule (18+ on day one).
 * Compared as calendar dates, so no timezone can shift a birthday by a day.
 */
export function ageAtEvent(dob: string | null): number | null {
  const parse = (d: string) => d.split("-").map(Number);
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [by, bm, bd] = parse(dob);
  const [ey, em, ed] = parse(process.env.NEXT_PUBLIC_EVENT_START ?? "2026-11-13");
  const beforeBirthday = em < bm || (em === bm && ed < bd);
  return ey - by - (beforeBirthday ? 1 : 0);
}

/** One shared deadline for accepted hackers to confirm their spot. */
export const RSVP_DEADLINE = new Date(
  process.env.NEXT_PUBLIC_RSVP_DEADLINE ?? "2026-10-17T06:59:00.000Z",
);

export function rsvpDeadlineLabel(): string {
  return RSVP_DEADLINE.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
}

/** Interest form for PICO, Immerse the Bay's Diamond sponsor. */
export const VIBELAB_INTEREST_FORM_URL =
  process.env.NEXT_PUBLIC_VIBELAB_INTEREST_FORM_URL ??
  "https://forms.gle/5QxFVQXd4ZJEPmje6";
