"use client";

import { useState, useTransition } from "react";
import { setApplicationWindow } from "@/lib/actions/admin";

export function ApplicationWindowAdmin({
  initialEnabled,
  initialAccepting,
  initialDeadline,
  source,
}: {
  initialEnabled: boolean;
  initialAccepting: boolean;
  initialDeadline: string;
  source: "database" | "environment";
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [accepting, setAccepting] = useState(initialAccepting);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setApplicationWindow(enabled, deadline).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (!result.ok) {
        setError(result.error ?? "Could not save application settings.");
        return;
      }
      setAccepting(result.accepting ?? false);
      setSaved(true);
    });
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Application intake</h2>
          <p className="mt-0.5 text-[12.5px] text-faint">
            Controls saving and submitting for both new and existing applicants
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${
            accepting
              ? "border-ok/50 bg-ok/10 text-ok"
              : "border-danger/50 bg-danger/10 text-danger"
          }`}
        >
          {accepting ? "Accepting applications" : "Applications closed"}
        </span>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(16rem,1fr)_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Status
          <select
            className="field"
            value={enabled ? "open" : "closed"}
            disabled={pending}
            onChange={(event) => {
              setEnabled(event.target.value === "open");
              setSaved(false);
            }}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Deadline · Pacific Time
          <input
            className="field"
            type="datetime-local"
            value={deadline}
            disabled={pending}
            onChange={(event) => {
              setDeadline(event.target.value);
              setSaved(false);
            }}
          />
        </label>

        <button
          type="button"
          className="btn-primary whitespace-nowrap"
          disabled={pending}
          onClick={save}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>

        <div className="sm:col-span-3" aria-live="polite">
          {error && <p className="text-[13px] text-danger">{error}</p>}
          {saved && <p className="text-[13px] text-ok">Application settings saved.</p>}
          {!error && !saved && source === "environment" && (
            <p className="text-[12px] text-faint">
              Currently using the deployment deadline. Saving creates the admin-managed setting.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
