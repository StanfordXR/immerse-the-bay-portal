import { z } from "zod";
import type { CheckInPerson, CheckInResult } from "@/lib/check-in-types";

type Staff = { id: string; role: "reviewer" | "admin" };
const requestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("search"), query: z.string().trim().min(2).max(100) }),
  z.strictObject({ action: z.literal("manual"), id: z.uuid() }),
  z.strictObject({ action: z.literal("scan"), code: z.string().min(1).max(120) }),
]);

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function createCheckInHandler(deps: {
  trustedOrigin?: string;
  authorize: () => Promise<Staff | null>;
  search: (query: string) => Promise<CheckInPerson[]>;
  checkIn: (id: string, actor: Staff, method: "search" | "qr") => Promise<CheckInResult | null>;
  verifyCode: (code: string) => string | null;
}) {
  return async (request: Request) => {
    const origin = request.headers.get("origin");
    if (!origin || (origin !== new URL(request.url).origin && origin !== deps.trustedOrigin)) {
      return respond({ error: "Open the check-in desk on the application portal." }, 403);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
      return respond({ error: "Invalid check-in request." }, 415);
    }
    try {
      const staff = await deps.authorize();
      if (!staff) return respond({ error: "Sign in to the portal as a reviewer or admin." }, 403);
      let payload: unknown;
      try {
        const body = await request.text();
        if (body.length > 1024) return respond({ error: "Invalid check-in request." }, 413);
        payload = JSON.parse(body);
      } catch {
        return respond({ error: "Invalid check-in request." }, 400);
      }
      const parsed = requestSchema.safeParse(payload);
      if (!parsed.success) return respond({ error: "Invalid check-in request." }, 400);
      const action = parsed.data;
      if (action.action === "search") return respond({ people: await deps.search(action.query) });

      const id = action.action === "scan" ? deps.verifyCode(action.code) : action.id;
      if (!id) return respond({ error: "This isn’t a valid Immerse the Bay badge. Try a name search." }, 400);
      const result = await deps.checkIn(id, staff, action.action === "scan" ? "qr" : "search");
      if (!result) return respond({ error: "No confirmed attendee matches. Check the name or ask an organizer." }, 404);
      return respond(result);
    } catch {
      // Do not log names, search terms, badge codes, or database query parameters.
      return respond({ error: "Check-in is temporarily unavailable. Please try again." }, 503);
    }
  };
}
