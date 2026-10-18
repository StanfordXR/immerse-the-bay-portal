const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const pacificParts = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsFor(date: Date): Record<string, string> {
  return Object.fromEntries(
    pacificParts
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

/** Value for a datetime-local input, always rendered in Pacific Time. */
export function formatPacificDateTimeInput(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const p = partsFor(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Parse a datetime-local value as Pacific Time, independent of the server or
 * administrator's local timezone. The round-trip rejects invalid dates and
 * the skipped hour during the spring DST transition.
 */
export function parsePacificDateTimeInput(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;

  // Converge from the UTC wall-clock value to the instant whose Pacific wall
  // clock has the requested fields. Two passes cover both PST and PDT.
  for (let i = 0; i < 3; i += 1) {
    const p = partsFor(new Date(candidate));
    const observed = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
    );
    candidate += target - observed;
  }

  const parsed = new Date(candidate);
  return formatPacificDateTimeInput(parsed) === raw ? parsed : null;
}
