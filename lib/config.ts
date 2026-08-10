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

export function closeDateLabel(): string {
  const close = applicationsClose();
  if (!close) return "TBA";
  return close.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
