import { NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/dal";
import { sendSubmissionConfirmation } from "@/lib/email";
import { getApplicationWindow } from "@/lib/application-window";
import { closeDateLabel, finalDecisionsLabel } from "@/lib/config";

/**
 * Admin-only: send a sample submission-confirmation email, for previewing
 * template changes in real inboxes. ?to= overrides the recipient (defaults
 * to the requesting admin).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return new Response("Forbidden", { status: 403 });

  const to = request.nextUrl.searchParams.get("to") || authz.user.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return new Response("Bad recipient", { status: 400 });
  }

  const applicationWindow = await getApplicationWindow();
  await sendSubmissionConfirmation(
    to,
    "Victor",
    closeDateLabel(applicationWindow.deadline),
    finalDecisionsLabel(applicationWindow.deadline),
  );
  return Response.json({ ok: true, to });
}
