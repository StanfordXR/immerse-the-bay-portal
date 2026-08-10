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
  const uid = useId();
  const r = 11;
  const c = 14;
  // 0 = fully covered (new moon), 2r+2 = fully clear (full moon)
  const shadowOffset = (phase / 4) * (2 * r + 2);
  const dim = state === "future";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="presentation"
      style={
        state === "current"
          ? { filter: "drop-shadow(0 0 7px rgba(110, 232, 247, 0.6))" }
          : undefined
      }
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx={c} cy={c} r={r} />
        </clipPath>
        {/* lit lunar surface: bright upper-left falling to a violet limb */}
        <radialGradient id={`${uid}-surf`} cx="0.35" cy="0.3" r="0.95">
          <stop
            offset="0%"
            stopColor={dim ? "#8a80b3" : state === "current" ? "#eafcff" : "#fdfcff"}
          />
          <stop
            offset="55%"
            stopColor={dim ? "#6c639b" : state === "current" ? "#9fe8f5" : "#d8d0f2"}
          />
          <stop
            offset="100%"
            stopColor={dim ? "#4e4778" : state === "current" ? "#6db8d9" : "#a191dd"}
          />
        </radialGradient>
        {/* soft terminator: the shadow's leading edge fades instead of cutting */}
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#131028" />
          <stop offset="82%" stopColor="#131028" />
          <stop offset="100%" stopColor="#131028" stopOpacity="0.1" />
        </radialGradient>
      </defs>

      {/* surface */}
      <circle cx={c} cy={c} r={r} fill={`url(#${uid}-surf)`} />

      {/* toon craters, visible only where the surface is lit */}
      <g clipPath={`url(#${uid}-clip)`} opacity={dim ? 0.25 : 0.4}>
        <circle cx="9.5" cy="10" r="2.1" fill="#8d7fc4" opacity="0.55" />
        <circle cx="9" cy="9.6" r="1.5" fill="#6e5fae" opacity="0.5" />
        <circle cx="17" cy="16.5" r="2.8" fill="#8d7fc4" opacity="0.4" />
        <circle cx="16.5" cy="16" r="2" fill="#6e5fae" opacity="0.35" />
        <circle cx="12" cy="18.5" r="1.3" fill="#6e5fae" opacity="0.45" />
        <circle cx="18.5" cy="9" r="1.1" fill="#6e5fae" opacity="0.4" />
      </g>

      {/* toon spec highlight */}
      {!dim && (
        <ellipse
          cx="10"
          cy="8.5"
          rx="3.2"
          ry="1.8"
          fill="#ffffff"
          opacity={state === "current" ? 0.65 : 0.45}
          transform="rotate(-32 10 8.5)"
        />
      )}

      {/* sliding shadow with soft terminator */}
      <g clipPath={`url(#${uid}-clip)`}>
        <circle
          cx={c + shadowOffset}
          cy={c}
          r={r + 2.5}
          fill={`url(#${uid}-shadow)`}
        />
      </g>

      {/* rim light */}
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={
          state === "current" ? "#4fd9ef" : state === "done" ? "#4a3d85" : "#2c2255"
        }
        strokeWidth="1.3"
      />
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
