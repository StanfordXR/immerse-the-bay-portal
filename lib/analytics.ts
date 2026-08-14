"use client";

import posthog from "posthog-js";

/**
 * Fire-and-forget event capture, shared by every client component.
 * Silent no-op without a key so local dev and previews stay clean.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.capture(event, props);
}
