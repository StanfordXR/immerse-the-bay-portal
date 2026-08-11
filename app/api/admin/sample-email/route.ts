import { NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/dal";
import { sendSubmissionConfirmation } from "@/lib/email";
import { closeDateLabel } from "@/lib/config";

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

  await sendSubmissionConfirmation(to, "Victor", closeDateLabel());
  return Response.json({ ok: true, to });
}
