import "server-only";
import { finalDecisionsLabel, priorityDecisionsLabel } from "@/lib/config";

/**
 * Transactional email via Resend's REST API — plain fetch, no SDK dependency.
 *
 * Degrades to a logged no-op when RESEND_API_KEY is unset, so the submit flow
 * never depends on email configuration. Every confirmation sent from launch day
 * onward doubles as domain warm-up for the decision send in October — a cold
 * domain blasting hundreds of near-identical messages gets bulk-foldered.
 */

type SendArgs = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: SendArgs): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    console.warn(`[email] RESEND_API_KEY unset — skipped "${subject}" to ${to}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(process.env.EMAIL_REPLY_TO
        ? { reply_to: process.env.EMAIL_REPLY_TO }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

export async function sendSubmissionConfirmation(
  to: string,
  firstName: string,
  closeLabel: string,
): Promise<void> {
  await sendEmail({
    to,
    subject: "Application received — Immerse the Bay 2026",
    text: [
      `Hi ${firstName},`,
      "",
      "Your application to Immerse the Bay 2026 is in.",
      "",
      `You can review or edit your application until applications close (${closeLabel}) at:`,
      `${process.env.BETTER_AUTH_URL ?? "https://portal.immersethebay.org"}/dashboard`,
      "",
      "What happens next:",
      "  1. Applications close, and our review team reads every application.",
      `  2. Decisions go out by email — priority round by ${priorityDecisionsLabel()}, final round by ${finalDecisionsLabel()}.`,
      "  3. The hackathon runs November 13–15 at Stanford.",
      "",
      "Add this address to your contacts so your decision doesn't land in spam.",
      "",
      "— The Stanford XR team",
      "https://immersethebay.org",
    ].join("\n"),
  });
}
