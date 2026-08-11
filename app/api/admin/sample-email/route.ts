import { NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/dal";
import { sendEmail, sendSubmissionConfirmation } from "@/lib/email";
import { EMAIL_DRAFTS } from "@/lib/email-drafts";
import { closeDateLabel } from "@/lib/config";

/**
 * Admin-only: send a sample submission-confirmation email, for previewing
 * template changes in real inboxes. ?to= overrides the recipient (defaults
 * to the requesting admin); ?variant=a|b|c sends a design draft instead of
 * the live template.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return new Response("Forbidden", { status: 403 });

  const to = request.nextUrl.searchParams.get("to") || authz.user.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return new Response("Bad recipient", { status: 400 });
  }

  const variant = request.nextUrl.searchParams.get("variant");
  if (variant) {
    const draft = EMAIL_DRAFTS[variant];
    if (!draft) return new Response("Unknown variant", { status: 400 });
    await sendEmail({
      to,
      subject: `[${draft.label}] Application received: Immerse the Bay 2026`,
      html: draft.render("Victor", closeDateLabel()),
      text: "HTML design draft, view in an HTML-capable client.",
    });
    return Response.json({ ok: true, to, variant });
  }

  await sendSubmissionConfirmation(to, "Victor", closeDateLabel());
  return Response.json({ ok: true, to });
}
