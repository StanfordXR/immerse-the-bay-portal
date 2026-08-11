import "server-only";
import { finalDecisionsLabel, priorityDecisionsLabel } from "@/lib/config";

/**
 * Design drafts for the submission-confirmation email, sent via the admin
 * sample route (?variant=d|e) so the team can compare in real inboxes.
 * Both use the Stanford XR letterhead (the chosen header); they differ in
 * where the edit-until line and the referral copy sit. The winner gets
 * folded into lib/email.ts and this file deleted.
 */

const SXR_LOGO = "https://i.imgur.com/ksJBwbD.png"; // same asset as the campaign emails

function portalBase(): string {
  return process.env.BETTER_AUTH_URL ?? "https://portal.immersethebay.org";
}

function letterhead(): string {
  return `
  <div style="text-align: center; margin-bottom: 8px;">
    <img src="${SXR_LOGO}" alt="Stanford XR" style="max-width: 220px; height: auto;">
  </div>
  <div style="height: 1px; background-color: #eee; margin: 0 0 24px 0;"></div>`;
}

function nextSteps(): string {
  return `
  <div style="background-color: #f9f9fb; padding: 15px 20px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
    <p style="margin: 0 0 6px 0;"><strong>What happens next:</strong></p>
    <p style="margin: 0 0 4px 0;">1. Our review team reads every application as it arrives.</p>
    <p style="margin: 0 0 4px 0;">2. Decisions go out by email: priority round by ${priorityDecisionsLabel()}, final round by ${finalDecisionsLabel()}.</p>
    <p style="margin: 0;">3. The hackathon runs November 13 to 15, 2026 at Stanford.</p>
  </div>`;
}

function button(caption: string): string {
  return `
  <div style="text-align: center; margin: 26px 0;">
    <a href="${portalBase()}/dashboard" style="display: inline-block; background-color: #8b5cf6; color: #ffffff !important; padding: 14px 0; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; width: 260px; text-align: center;">View your application</a>
    ${caption}
  </div>`;
}

function outro(): string {
  return `
  <p style="margin: 20px 0 0 0;">Any questions? Email <a href="mailto:admin@stanfordxr.org" style="color: #6c5ce7; text-decoration: none;">admin@stanfordxr.org</a>.</p>
  <p style="margin: 20px 0 0 0;"><strong>Warmly,</strong><br>The Stanford XR team</p>
  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #aaa;">
    <a href="https://immersethebay.org" style="color: #aaa; text-decoration: none;">immersethebay.org</a> · <a href="https://stanfordxr.org" style="color: #aaa; text-decoration: none;">stanfordxr.org</a>
  </div>`;
}

function shell(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
${body}
</body>
</html>`;
}

/**
 * D. Flipped: referral talk lives in the description, the edit-until line
 * sits underneath the View your application button.
 */
export function draftD(name: string, closeLabel: string): string {
  return shell(`${letterhead()}
  <p>Hi ${name},</p>
  <p><strong>Thank you for applying to Immerse the Bay 2026.</strong> Your application is in, and we are excited to read it. Bring your friends along too: share your referral link from your dashboard and climb the leaderboard. Top referrers get shoutouts at the opening ceremony.</p>
  ${button(`<p style="font-size: 12px; color: #999; margin: 10px 0 0 0;">You can review or edit your answers anytime until applications close on ${closeLabel}</p>`)}
  ${nextSteps()}
  ${outro()}`);
}

/**
 * E. Unflipped: edit-until line stays in the opening paragraph, referral
 * line stays underneath the button.
 */
export function draftE(name: string, closeLabel: string): string {
  return shell(`${letterhead()}
  <p>Hi ${name},</p>
  <p><strong>Thank you for applying to Immerse the Bay 2026.</strong> Your application is in, and we are excited to read it. You can review or edit your answers anytime until applications close on <strong>${closeLabel}</strong>.</p>
  ${button(`<p style="font-size: 12px; color: #999; margin: 10px 0 0 0;">Share your referral link from the dashboard and climb the leaderboard</p>`)}
  ${nextSteps()}
  ${outro()}`);
}

export const EMAIL_DRAFTS: Record<
  string,
  { label: string; render: (name: string, closeLabel: string) => string }
> = {
  d: { label: "Draft D, referral in body, edit line under button", render: draftD },
  e: { label: "Draft E, edit line in body, referral under button", render: draftE },
};
