import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckInTarget } from "@/lib/check-in-types";

const prefix = "itb2026";
const badgePattern = /^itb2026\.([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;
const staffPattern = /^itb2026\.staff\.([A-Za-z0-9_-]{1,171})\.([A-Za-z0-9_-]{43})$/;
export const MAX_CHECK_IN_CODE_LENGTH = 240;

function sign(purpose: "badge" | "staff-badge", id: string, secret: string) {
  if (!secret) throw new Error("The check-in badge signing key is not configured.");
  return createHmac("sha256", secret).update(`itb2026/check-in/${purpose}/v1:${id}`).digest("base64url");
}

/** A badge carries an event-scoped, signed identifier; never a name, email, or session token. */
export function createCheckInCode(id: string, secret: string) {
  return `${prefix}.${id}.${sign("badge", id, secret)}`;
}

export function verifyCheckInCode(code: string, secret: string): string | null {
  const match = badgePattern.exec(code);
  if (!match || match[0] !== code) return null;
  const [, id, signature] = match;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign("badge", id, secret))) ? id : null;
}

export function createStaffCheckInCode(userId: string, secret: string) {
  const id = Buffer.from(userId, "utf8").toString("base64url");
  if (!id || id.length > 171) throw new Error("Invalid staff badge identifier.");
  return `${prefix}.staff.${id}.${sign("staff-badge", id, secret)}`;
}

export function verifyBadgeCode(code: string, secret: string): CheckInTarget | null {
  const hackerId = verifyCheckInCode(code, secret);
  if (hackerId) return { kind: "hacker", id: hackerId };
  const match = staffPattern.exec(code);
  if (!match || match[0] !== code) return null;
  const [, encoded, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign("staff-badge", encoded, secret)))) return null;
  const id = Buffer.from(encoded, "base64url").toString("utf8");
  if (!id || id.includes("\0") || Buffer.from(id, "utf8").toString("base64url") !== encoded) return null;
  return { kind: "staff", id };
}
