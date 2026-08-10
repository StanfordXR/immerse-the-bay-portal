"use client";

/**
 * Minimal five-stage progress rail: filled segments for completed stages, a
 * glowing segment for the current one. Labels appear on ≥sm; the form card's
 * own header carries "Step N of 5" on mobile.
 */
export function Stepper({
  steps,
  current,
  furthestValid,
  onNavigate,
}: {
  steps: ReadonlyArray<{ readonly title: string }>;
  current: number;
  /** Highest step index the user may jump to directly. */
  furthestValid: number;
  onNavigate: (index: number) => void;
}) {
  return (
    <ol className="flex gap-2" aria-label="Application steps">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "future";
        const reachable = i <= furthestValid;
        return (
          <li key={step.title} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => reachable && onNavigate(i)}
              disabled={!reachable}
              aria-current={i === current ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${step.title}${state === "done" ? " (complete)" : ""}`}
              className={`w-full text-left ${reachable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                aria-hidden
                className="block h-1 rounded-full transition-colors"
                style={{
                  background:
                    state === "current"
                      ? "var(--color-cyan)"
                      : state === "done"
                        ? "color-mix(in oklab, var(--color-cyan) 45%, var(--color-line))"
                        : "var(--color-line)",
                  boxShadow:
                    state === "current"
                      ? "0 0 10px color-mix(in oklab, var(--color-cyan) 55%, transparent)"
                      : undefined,
                }}
              />
              <span
                className={`mt-2 hidden truncate text-[12.5px] sm:block ${
                  state === "current"
                    ? "font-medium text-moonlit"
                    : state === "done"
                      ? "text-muted"
                      : "text-faint"
                }`}
              >
                {step.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
