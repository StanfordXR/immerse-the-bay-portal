export const REFERRAL_COOKIE = "itb_ref";

/** Match the six-character alphabet used by lib/referral.ts. */
export const REFERRAL_CODE_PATTERN = /^[a-hjkmnp-z2-9]{6}$/;

/** Keep the claim available for the full application campaign. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export type ReferralEntryPoint = "site" | "portal";

export type ReferralCookie = {
  code: string;
  entryPoint: ReferralEntryPoint;
  clickedAt: number;
};

export function parseReferralCookie(
  raw: string | null | undefined,
): ReferralCookie | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const value = parsed as Record<string, unknown>;
    if (
      typeof value.code !== "string" ||
      !REFERRAL_CODE_PATTERN.test(value.code) ||
      (value.entryPoint !== "site" && value.entryPoint !== "portal") ||
      typeof value.clickedAt !== "number" ||
      !Number.isFinite(value.clickedAt) ||
      value.clickedAt <= 0
    ) {
      return null;
    }

    return {
      code: value.code,
      entryPoint: value.entryPoint,
      clickedAt: value.clickedAt,
    };
  } catch {
    return null;
  }
}

export function serializeReferralCookie(value: ReferralCookie): string {
  return JSON.stringify(value);
}
