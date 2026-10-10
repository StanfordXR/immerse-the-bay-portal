"use client";

import { useState, useTransition } from "react";
import { declineSpot } from "@/lib/actions/decision";
import { track } from "@/lib/analytics";

/**
 * Decline button on an accepted hacker's decision card. Declining is final,
 * so it takes a second click. `subtle` is the small link shown once they've
 * already confirmed.
 */
export function DeclineSpot({ subtle = false }: { subtle?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineSpot().catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (result.ok) track("rsvp_submitted", { choice: "declined" });
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[14px] text-muted">Give up your spot? This can&apos;t be undone.</p>
          <button type="button" className="btn-ghost !py-2 text-[14px] !text-danger" disabled={pending} onClick={decline}>
            {pending ? "One moment…" : "Yes, decline"}
          </button>
          <button
            type="button"
            className="text-[14px] text-muted underline-offset-2 hover:underline"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Keep my spot
          </button>
        </div>
      ) : subtle ? (
        <button
          type="button"
          className="self-start text-[13.5px] text-faint underline-offset-2 hover:text-muted hover:underline"
          onClick={() => setConfirming(true)}
        >
          Plans changed? Give up your spot
        </button>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
          I can&apos;t make it
        </button>
      )}
      {error && (
        <p className="text-[13.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
