import posthog from "posthog-js";

/**
 * PostHog: the funnel is how we find the step that loses applicants — last
 * year's form lost 54% of everyone who started it. No key → clean no-op.
 *
 * Before recording real applicants: verify input masking on the actual form
 * and keep IP anonymization on. This form collects PII.
 */
// Only the real portal host: localhost and preview-deploy sessions were
// polluting production analytics.
const isProductionHost =
  typeof window !== "undefined" &&
  /(^|\.)immersethebay\.org$/.test(window.location.hostname);

if (process.env.NEXT_PUBLIC_POSTHOG_KEY && isProductionHost) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    defaults: "2025-05-24",
    // Replay masks all inputs — do not loosen on a form full of PII.
    session_recording: { maskAllInputs: true },
  });
}
