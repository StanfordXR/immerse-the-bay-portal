import "server-only";
import { and, eq } from "drizzle-orm";
import { toDataURL } from "qrcode";
import { auth } from "@/lib/auth";
import { createCheckInCode } from "@/lib/check-in-badge";
import { db } from "@/lib/db";
import { createCheckInStore } from "@/lib/db/check-in";
import { application } from "@/lib/db/schema";
import { isRole } from "@/lib/permissions";

/**
 * Gate for the marketing site's Live Dashboard (immersethebay.org/dashboard).
 *
 * The portal's session cookie is scoped to this host, so the marketing site
 * can't see it. /live-dashboard copies the signed session token into
 * SHARED_SESSION_COOKIE on COOKIE_DOMAIN (`.immersethebay.org`), and the
 * marketing server sends it back to /api/attendee to ask who it is. The token
 * stays httpOnly and is validated here against the session table, so signing
 * out (or a revoked session) closes the dashboard too.
 */
export const SHARED_SESSION_COOKIE = "itb_session";
const BADGE_OPENS_AT = Date.parse("2026-11-11T00:00:00-08:00");

export const MARKETING_URL =
  process.env.MARKETING_URL ?? "https://immersethebay.org";

/**
 * Response body of /api/attendee. Mirrored in the marketing repo's lib/attendee.ts.
 * "confirmed" means allowed in: a confirmed hacker, or staff (admin/reviewer).
 */
export type AttendeeStatus =
  | { status: "signed-out" }
  | { status: "not-confirmed" }
  | { status: "confirmed"; name: string; audience: "staff" | "hacker"; badgeQr?: string };

/** Resolves a shared session token to whether its holder may see the dashboard. */
export async function attendeeStatus(
  token: string | undefined,
  includeBadge = false,
): Promise<AttendeeStatus> {
  if (!token) return { status: "signed-out" };

  const { authCookies } = await auth.$context;
  const session = await auth.api.getSession({
    headers: new Headers({
      cookie: `${authCookies.sessionToken.name}=${encodeURIComponent(token)}`,
    }),
  });
  if (!session) return { status: "signed-out" };

  const { role } = session.user;
  if (isRole(role) && role !== "applicant") {
    return { status: "confirmed", name: session.user.name, audience: "staff" };
  }

  const [confirmed] = await db
    .select({ id: application.id })
    .from(application)
    .where(
      and(
        eq(application.userId, session.user.id),
        eq(application.stage, "decided"),
        eq(application.decision, "accepted"),
        eq(application.rsvp, "confirmed"),
      ),
    )
    .limit(1);

  if (!confirmed) return { status: "not-confirmed" };

  const result: AttendeeStatus = { status: "confirmed", name: session.user.name, audience: "hacker" };
  if (includeBadge && Date.now() >= BADGE_OPENS_AT) {
    const badge = await createCheckInStore(db).badgeForUser(session.user.id);
    if (badge) {
      result.name = badge.name;
      result.badgeQr = await toDataURL(createCheckInCode(badge.id, process.env.BETTER_AUTH_SECRET ?? ""), {
        errorCorrectionLevel: "M",
        margin: 4,
        scale: 6,
      });
    }
  }
  return result;
}
