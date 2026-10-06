"use client";

import { useState, useTransition } from "react";
import { respondToInvite } from "@/lib/actions/decision";
import { track } from "@/lib/analytics";

/**
 * Confirm / decline buttons on an accepted hacker's decision card. Declining
 * is final, so it takes a second click. `confirmed` shows only the decline
 * path, for a confirmed hacker whose plans changed.
 */
export function RsvpActions({ confirmed = false }: { confirmed?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function respond(choice: "confirmed" | "declined") {
    setError(null);
    startTransition(async () => {
      const result = await respondToInvite(choice).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (result.ok) track("rsvp_submitted", { choice });
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {confirmingDecline ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[14px] text-muted">
            Give up your spot? This can&apos;t be undone.
          </p>
          <button
            type="button"
            className="btn-ghost !py-2 text-[14px] !text-danger"
            disabled={pending}
            onClick={() => respond("declined")}
          >
            {pending ? "One moment…" : "Yes, decline"}
          </button>
          <button
            type="button"
            className="text-[14px] text-muted underline-offset-2 hover:underline"
            disabled={pending}
            onClick={() => setConfirmingDecline(false)}
          >
            Keep my spot
          </button>
        </div>
      ) : confirmed ? (
        <button
          type="button"
          className="self-start text-[13.5px] text-faint underline-offset-2 hover:text-muted hover:underline"
          onClick={() => setConfirmingDecline(true)}
        >
          Plans changed? Give up your spot
        </button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => respond("confirmed")}
          >
            {pending ? "One moment…" : "Confirm my spot"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => setConfirmingDecline(true)}
          >
            I can&apos;t make it
          </button>
        </div>
      )}
      {error && (
        <p className="text-[13.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
