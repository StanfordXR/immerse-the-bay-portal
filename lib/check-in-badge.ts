import { createHmac, timingSafeEqual } from "node:crypto";

const prefix = "itb2026";
const badgePattern = /^itb2026\.([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

function sign(id: string, secret: string) {
  if (!secret) throw new Error("The check-in badge signing key is not configured.");
  return createHmac("sha256", secret).update(`itb2026/check-in/badge/v1:${id}`).digest("base64url");
}

/** A badge carries an event-scoped, signed identifier; never a name, email, or session token. */
export function createCheckInCode(id: string, secret: string) {
  return `${prefix}.${id}.${sign(id, secret)}`;
}

export function verifyCheckInCode(code: string, secret: string): string | null {
  const match = badgePattern.exec(code);
  if (!match || match[0] !== code) return null;
  const [, id, signature] = match;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id, secret))) ? id : null;
}
