import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getSession } from "@/lib/dal";
import { MARKETING_URL, SHARED_SESSION_COOKIE } from "@/lib/live-dashboard";

/**
 * Hand-off to the marketing site's Live Dashboard. Signed-out visitors go
 * through sign-in and come back here; signed-in ones get the shared session
 * cookie (see lib/live-dashboard.ts) and are sent to immersethebay.org/dashboard.
 * Whether they're allowed in is decided there, via /api/attendee.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const token = getSessionCookie(request);
  if (!session || !token) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", "/live-dashboard");
    return NextResponse.redirect(signIn);
  }

  // `signed_in` tells the dashboard not to bounce back here if the cookie
  // still didn't arrive (e.g. COOKIE_DOMAIN unset), which would loop forever.
  const response = NextResponse.redirect(`${MARKETING_URL}/dashboard?signed_in=1`);
  response.cookies.set({
    name: SHARED_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.session.expiresAt,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });
  return response;
}
