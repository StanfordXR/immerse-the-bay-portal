import "server-only";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

export const MARKETING_URL =
  process.env.MARKETING_URL ?? "https://immersethebay.org";

/**
 * Response body of /api/attendee. Mirrored in the marketing repo's lib/attendee.ts.
 * "confirmed" means allowed in: a confirmed hacker, or staff (admin/reviewer).
 */
export type AttendeeStatus =
  | { status: "signed-out" }
  | { status: "not-confirmed" }
  | { status: "confirmed"; name: string };

/** Resolves a shared session token to whether its holder may see the dashboard. */
export async function attendeeStatus(
  token: string | undefined,
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
    return { status: "confirmed", name: session.user.name };
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

  return confirmed
    ? { status: "confirmed", name: session.user.name }
    : { status: "not-confirmed" };
}
