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
  html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendArgs): Promise<void> {
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
      ...(html ? { html } : {}),
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Branded HTML body for the submission confirmation. Table-free 600px layout
 * in the style of the Stanford XR campaign emails (Arial, light background,
 * violet accents); every style is inline for email-client compatibility.
 * The plain-text part remains the deliverability workhorse.
 */
export function submissionConfirmationHtml(
  firstName: string,
  closeLabel: string,
): string {
  const portal = process.env.BETTER_AUTH_URL ?? "https://portal.immersethebay.org";
  const name = escapeHtml(firstName);
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 26px;">
    <img src="${portal}/icon.png" alt="Immerse the Bay" width="72" height="72" style="width: 72px; height: 72px;">
  </div>

  <div style="background-color: #f6f3ff; padding: 18px 20px; border-left: 4px solid #8b5cf6; margin: 0 0 24px 0; border-radius: 4px; text-align: center;">
    <div style="color: #8b5cf6; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 13px; margin-bottom: 6px;">Application received</div>
    <h2 style="margin: 0; color: #1a1033;">Thank you for applying to Immerse the Bay 2026</h2>
  </div>

  <p>Hi ${name},</p>

  <p>Your application is in, and we are excited to read it. You can review or edit your answers any time until applications close on <strong>${escapeHtml(closeLabel)}</strong>.</p>

  <div style="text-align: center; margin: 26px 0;">
    <a href="${portal}/dashboard" style="display: inline-block; background-color: #8b5cf6; color: #ffffff !important; padding: 14px 0; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; width: 260px; text-align: center;">View your application</a>
    <p style="font-size: 12px; color: #999; margin: 10px 0 0 0;">Share your referral link from the dashboard and climb the leaderboard</p>
  </div>

  <div style="background-color: #f9f9fb; padding: 15px 20px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
    <p style="margin: 0 0 6px 0;"><strong>What happens next:</strong></p>
    <p style="margin: 0 0 4px 0;">1. Our review team reads every application as it arrives.</p>
    <p style="margin: 0 0 4px 0;">2. Decisions go out by email: priority round by ${escapeHtml(priorityDecisionsLabel())}, final round by ${escapeHtml(finalDecisionsLabel())}.</p>
    <p style="margin: 0;">3. The hackathon runs November 13 to 15, 2026 at Stanford.</p>
  </div>

  <p style="margin: 20px 0 0 0;">Any questions? Email <a href="mailto:admin@stanfordxr.org" style="color: #6c5ce7; text-decoration: none;">admin@stanfordxr.org</a>.</p>

  <p style="margin: 20px 0 0 0;"><strong>Warmly,</strong><br>The Stanford XR team</p>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #aaa;">
    <a href="https://immersethebay.org" style="color: #aaa; text-decoration: none;">immersethebay.org</a> · <a href="https://stanfordxr.org" style="color: #aaa; text-decoration: none;">stanfordxr.org</a>
  </div>
</body>
</html>`;
}

export async function sendSubmissionConfirmation(
  to: string,
  firstName: string,
  closeLabel: string,
): Promise<void> {
  await sendEmail({
    to,
    subject: "Application received: Immerse the Bay 2026",
    html: submissionConfirmationHtml(firstName, closeLabel),
    text: [
      `Hi ${firstName},`,
      "",
      "Thank you for applying to Immerse the Bay 2026. Your application is in, and we are excited to read it.",
      "",
      `You can review or edit your application until applications close (${closeLabel}) at:`,
      `${process.env.BETTER_AUTH_URL ?? "https://portal.immersethebay.org"}/dashboard`,
      "",
      "What happens next:",
      "  1. Our review team reads every application as it arrives.",
      `  2. Decisions go out by email: priority round by ${priorityDecisionsLabel()}, final round by ${finalDecisionsLabel()}.`,
      "  3. The hackathon runs November 13 to 15, 2026 at Stanford.",
      "",
      "Any questions? Email admin@stanfordxr.org.",
      "",
      "Warmly,",
      "The Stanford XR team",
      "https://immersethebay.org",
    ].join("\n"),
  });
}
