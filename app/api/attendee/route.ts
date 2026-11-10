import type { NextRequest } from "next/server";
import { attendeeStatus, SHARED_SESSION_COOKIE } from "@/lib/live-dashboard";

/**
 * Called server-to-server by the marketing site's /dashboard with the shared
 * session cookie forwarded. Answers whether its holder is an accepted hacker
 * who confirmed their spot.
 */
export async function GET(request: NextRequest) {
  const status = await attendeeStatus(
    request.cookies.get(SHARED_SESSION_COOKIE)?.value,
    request.nextUrl.searchParams.get("badge") === "1",
  );
  return Response.json(status, { headers: { "Cache-Control": "private, no-store" } });
}
