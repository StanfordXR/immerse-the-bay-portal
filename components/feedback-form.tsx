"use client";

import { useState } from "react";
import { submitFeedback } from "@/lib/actions/feedback";
import { track } from "@/lib/analytics";

const FIELDS = [
  {
    key: "deviceMethod",
    label: "Device, browser, and sign-in method(s) you used",
    placeholder: "e.g. iPhone 15 Safari, signed in with GitHub and Google",
    rows: 1,
  },
  {
    key: "broke",
    label: "Did anything break, error, or hang?",
    placeholder: "What happened, and where? Screenshots can go in #xr-core.",
    rows: 3,
  },
  {
    key: "friction",
    label: "Where did you hesitate or get confused, even for a second?",
    placeholder: "The most valuable answer on this page.",
    rows: 3,
  },
  {
    key: "formNotes",
    label: "Any other feedback?",
    placeholder: "Confusing questions, how long it took, mobile layout, anything else.",
    rows: 3,
  },
] as const;

export function FeedbackForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const result = await submitFeedback(values).catch(() => ({
      ok: false,
      error: "Network hiccup. Try again.",
    }));
    if (result.ok) {
      setState("done");
      track("feedback_submitted");
    } else {
      setState("idle");
      setError(("error" in result && result.error) || "Try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-xl font-semibold text-ok">
          Feedback received. Thank you!
        </p>
        <p className="mt-2 text-[14px] text-muted">
          Drop a ✅ in #xr-core so we know you are done.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="card flex flex-col gap-5 p-6 sm:p-8">
      {FIELDS.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label htmlFor={f.key} className="text-[13.5px] font-medium text-muted">
            {f.label}
          </label>
          {f.rows === 1 ? (
            <input
              id={f.key}
              className="field"
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
            />
          ) : (
            <textarea
              id={f.key}
              rows={f.rows}
              className="field resize-y"
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
            />
          )}
        </div>
      ))}

      {error && (
        <p className="text-[13.5px] text-danger" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={state === "busy"}>
        {state === "busy" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
