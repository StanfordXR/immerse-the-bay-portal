"use client";

import { useState, useTransition } from "react";
import { setDecision, toggleApplicationTag } from "@/lib/actions/admin";

/** Tag chips on the admin application detail page. */
export function TagToggles({
  applicationId,
  allTags,
  applied,
}: {
  applicationId: string;
  allTags: { id: string; name: string }[];
  applied: string[];
}) {
  const [selected, setSelected] = useState(new Set(applied));
  const [, startTransition] = useTransition();

  function toggle(tagId: string) {
    const on = !selected.has(tagId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(tagId);
      else next.delete(tagId);
      return next;
    });
    startTransition(async () => {
      const result = await toggleApplicationTag(applicationId, tagId, on).catch(
        () => ({ ok: false as const }),
      );
      if (!result.ok) {
        // revert on failure
        setSelected((prev) => {
          const next = new Set(prev);
          if (on) next.delete(tagId);
          else next.add(tagId);
          return next;
        });
      }
    });
  }

  if (allTags.length === 0) {
    return (
      <p className="text-[13.5px] text-faint">
        No tags defined yet. Create some under Admin → Tags.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Tags">
      {allTags.map((t) => (
        <button
          key={t.id}
          type="button"
          className="chip"
          aria-pressed={selected.has(t.id)}
          onClick={() => toggle(t.id)}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

/** Decision marker. Marks only — release/emails are a separate future flow. */
export function DecisionPanel({
  applicationId,
  initialDecision,
  initialNote,
}: {
  applicationId: string;
  initialDecision: string | null;
  initialNote: string;
}) {
  const [decision, setDecisionState] = useState(initialDecision ?? "none");
  const [note, setNote] = useState(initialNote);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setDecision(applicationId, decision, note).catch(
        () => ({ ok: false as const, error: "Network hiccup. Try again." }),
      );
      if (result.ok) setSaved(true);
      else setError(("error" in result && result.error) || "Try again.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          className="field !w-auto !py-2 text-[14px]"
          value={decision}
          disabled={pending}
          onChange={(e) => {
            setDecisionState(e.target.value);
            setSaved(false);
          }}
          aria-label="Decision"
        >
          <option value="none">No decision</option>
          <option value="accepted">Accepted</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          type="button"
          className="btn-primary !py-2 !text-[14px]"
          onClick={save}
          disabled={pending || saved}
        >
          {pending ? "Saving…" : saved ? "Saved ✓" : "Save decision"}
        </button>
      </div>
      <textarea
        className="field resize-y"
        rows={2}
        placeholder="Internal note, optional. Applicants never see this."
        value={note}
        maxLength={2000}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
      />
      <p className="text-[12.5px] text-faint">
        Marking a decision sends nothing. Decision emails go out through a
        separate release step in October.
      </p>
      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
