export const ATTRIBUTION_COOKIE = "itb_attr";

/** ~90 days: comfortably outlives the application window. */
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 90;

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  ref?: string;
  lp?: string;
  ts?: number;
};

/**
 * Lowercase, trim, strip punctuation, cap length.
 *
 * UTM values are case-sensitive to every analytics tool there is, so `Instagram`,
 * `instagram` and `INSTAGRAM ` become three separate rows in every report. The
 * convention gets written down for whoever builds links, but normalising on the
 * server is the only defence that actually holds — the person assembling a link
 * at 1am will not remember it.
 */
export function normalizeUtm(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
  return cleaned || undefined;
}

export function parseAttribution(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Attribution;
  } catch {
    // A malformed cookie must never break a submission.
    return {};
  }
}

/** Shape stored on `application` / `user_attribution`. */
export function toAttributionColumns(attr: Attribution) {
  return {
    utmSource: attr.source ?? null,
    utmMedium: attr.medium ?? null,
    utmCampaign: attr.campaign ?? null,
    utmContent: attr.content ?? null,
    utmTerm: attr.term ?? null,
    referrer: attr.ref ?? null,
    landingPath: attr.lp ?? null,
    firstTouchAt: attr.ts ? new Date(attr.ts) : null,
  };
}
