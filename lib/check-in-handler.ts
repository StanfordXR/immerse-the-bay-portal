import { z } from "zod";
import { MAX_CHECK_IN_CODE_LENGTH } from "@/lib/check-in-badge";
import type { CheckInPerson, CheckInResult, CheckInStats, CheckInTarget } from "@/lib/check-in-types";
import type { StaffRole } from "@/lib/permissions";

type Staff = { id: string; role: StaffRole };
const requestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("search"), query: z.string().trim().min(2).max(100) }),
  z.strictObject({ action: z.literal("manual"), id: z.uuid() }),
  z.strictObject({ action: z.literal("scan"), code: z.string().min(1).max(MAX_CHECK_IN_CODE_LENGTH) }),
]);

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function createCheckInStatsHandler(deps: {
  authorize: () => Promise<Staff | null>;
  stats: () => Promise<CheckInStats>;
}) {
  return async () => {
    try {
      if (!await deps.authorize()) return respond({ error: "Sign in to the portal as a reviewer or admin." }, 403);
      return respond(await deps.stats());
    } catch {
      return respond({ error: "Attendance totals are temporarily unavailable." }, 503);
    }
  };
}

export function createCheckInHandler(deps: {
  trustedOrigin?: string;
  authorize: () => Promise<Staff | null>;
  search: (query: string) => Promise<CheckInPerson[]>;
  checkIn: (id: string, actor: Staff, method: "search" | "qr") => Promise<CheckInResult | null>;
  checkInStaff: (id: string, actor: Staff) => Promise<CheckInResult | null>;
  verifyCode: (code: string) => CheckInTarget | null;
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

      const target: CheckInTarget | null = action.action === "scan"
        ? deps.verifyCode(action.code)
        : { kind: "hacker", id: action.id };
      if (!target) return respond({ error: "This isn’t a valid Immerse the Bay badge. Try a name search or ask an organizer." }, 400);
      const result = target.kind === "staff"
        ? await deps.checkInStaff(target.id, staff)
        : await deps.checkIn(target.id, staff, action.action === "scan" ? "qr" : "search");
      if (!result) return respond({ error: "No confirmed attendee matches. Check the name or ask an organizer." }, 404);
      return respond(result);
    } catch {
      // Do not log names, search terms, badge codes, or database query parameters.
      return respond({ error: "Check-in is temporarily unavailable. Please try again." }, 503);
    }
  };
}
