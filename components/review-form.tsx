"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimNext, releaseClaim, submitReview } from "@/lib/actions/review";
import {
  COMMENT_MAX,
  RUBRIC,
  SCORE_VALUES,
  weightedScore,
  type RubricKey,
  type RubricScores,
} from "@/lib/review";

function isComplete(s: Partial<RubricScores>): s is RubricScores {
  return RUBRIC.every((c) => s[c.key] !== undefined);
}

/**
 * The rubric on /review/[id]. `initial` is set when re-opening a review the
 * reviewer already submitted; otherwise this is a fresh claim, which can be
 * released back to the queue.
 */
export function ReviewForm({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: (RubricScores & { comment: string }) | null;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Partial<RubricScores>>(initial ?? {});
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = isComplete(scores) ? weightedScore(scores) : null;

  function submit(andNext: boolean) {
    if (!isComplete(scores)) {
      setError("Score every category first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReview({
        applicationId,
        ...scores,
        comment,
      }).catch(() => ({ ok: false as const, error: "Network hiccup. Try again." }));
      if (!result.ok) return setError(result.error);
      if (andNext) await claimNext();
      else router.push("/review");
    });
  }

  const pick = (key: RubricKey, value: number) =>
    setScores((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      {RUBRIC.map((c) => (
        <fieldset key={c.key} disabled={pending}>
          <legend className="text-[15px] font-medium">
            {c.label}{" "}
            <span className="font-mono text-[12px] text-faint">×{c.weight}</span>
          </legend>
          <p className="mb-2.5 mt-0.5 text-[13px] text-muted">{c.hint}</p>
          <div className="flex gap-2" role="group" aria-label={c.label}>
            {SCORE_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                className="chip w-11 justify-center tabular-nums"
                aria-pressed={scores[c.key] === v}
                onClick={() => pick(c.key, v)}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-medium">
          Comments <span className="text-[13px] font-normal text-faint">(optional)</span>
        </span>
        <textarea
          className="field resize-y"
          rows={3}
          maxLength={COMMENT_MAX}
          placeholder="Anything the admins should know. Red flags, standouts, context."
          value={comment}
          disabled={pending}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() => submit(true)}
        >
          {pending ? "Saving…" : "Submit and next →"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={() => submit(false)}
        >
          Submit
        </button>
        {!initial && (
          <button
            type="button"
            className="btn-ghost ml-auto text-muted"
            disabled={pending}
            onClick={() => startTransition(() => releaseClaim(applicationId))}
          >
            Release to queue
          </button>
        )}
        {total !== null && (
          <span className="font-mono text-[13px] text-faint">
            weighted {total.toFixed(2)} / 5
          </span>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
