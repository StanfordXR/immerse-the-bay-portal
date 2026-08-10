"use client";

import { useId } from "react";

/**
 * Moon phases 0 through 4: new, waxing crescent, first quarter, waxing
 * gibbous, full. Half a lunar cycle across the five form steps. Drawn as a
 * lit disc progressively revealed as a shadow disc slides off it.
 */
export function MoonGlyph({
  phase,
  size = 28,
  state = "future",
}: {
  phase: 0 | 1 | 2 | 3 | 4;
  size?: number;
  state?: "done" | "current" | "future";
}) {
  const clipId = useId();
  const r = 11;
  const c = 14;
  // 0 = fully covered (new moon), 2r+2 = fully clear (full moon)
  const shadowOffset = (phase / 4) * (2 * r + 2);

  const litFill =
    state === "future" ? "#5a5180" : state === "current" ? "#aef2fb" : "#ece7fb";
  const ring =
    state === "current" ? "#29c8e6" : state === "done" ? "#3b2f6e" : "#2c2255";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="presentation"
      style={
        state === "current"
          ? { filter: "drop-shadow(0 0 6px rgba(110, 232, 247, 0.55))" }
          : undefined
      }
    >
      <clipPath id={clipId}>
        <circle cx={c} cy={c} r={r} />
      </clipPath>
      <circle cx={c} cy={c} r={r} fill={litFill} />
      <g clipPath={`url(#${clipId})`}>
        <circle cx={c + shadowOffset} cy={c} r={r + 1.5} fill="#151030" />
      </g>
      <circle cx={c} cy={c} r={r} fill="none" stroke={ring} strokeWidth="1.4" />
    </svg>
  );
}

/** Five-step progress rail with moon-phase nodes, new moon to full moon. */
export function Stepper({
  steps,
  current,
  furthestValid,
  onNavigate,
}: {
  steps: ReadonlyArray<{ readonly title: string }>;
  current: number;
  furthestValid: number;
  onNavigate: (index: number) => void;
}) {
  return (
    <ol className="flex items-start" aria-label="Application steps">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "future";
        const reachable = i <= furthestValid;
        return (
          <li key={step.title} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                aria-hidden
                className={`h-px flex-1 ${i === 0 ? "opacity-0" : ""}`}
                style={{
                  background:
                    i <= current
                      ? "color-mix(in oklab, var(--color-cyan) 45%, var(--color-line))"
                      : "var(--color-line)",
                }}
              />
              <button
                type="button"
                onClick={() => reachable && onNavigate(i)}
                disabled={!reachable}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${step.title}${state === "done" ? " (complete)" : ""}`}
                className={`rounded-full p-0.5 ${reachable ? "cursor-pointer" : "cursor-default"}`}
              >
                <MoonGlyph phase={i as 0 | 1 | 2 | 3 | 4} state={state} />
              </button>
              <span
                aria-hidden
                className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : ""}`}
                style={{
                  background:
                    i < current
                      ? "color-mix(in oklab, var(--color-cyan) 45%, var(--color-line))"
                      : "var(--color-line)",
                }}
              />
            </div>
            <span
              className={`hidden truncate text-[12.5px] sm:block ${
                state === "current"
                  ? "font-medium text-moonlit"
                  : state === "done"
                    ? "text-muted"
                    : "text-faint"
              }`}
            >
              {step.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
