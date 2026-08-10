"use client";

/**
 * Moon phases 0 through 4: new, waxing crescent, first quarter, waxing
 * gibbous, full. Half a lunar cycle across the five form steps.
 *
 * The moons are pre-rendered toon art (canvas-baked PNGs in public/moons/,
 * 120px source shown at 30px): cel-shaded surface bands, bold craters with
 * catchlight rims, and a soft elliptical terminator. Two palettes exist,
 * cyan for the current step and lavender for the rest; the future state
 * dims the lavender art with CSS filters.
 */
export function MoonGlyph({
  phase,
  size = 30,
  state = "future",
}: {
  phase: 0 | 1 | 2 | 3 | 4;
  size?: number;
  state?: "done" | "current" | "future";
}) {
  const src = `/moons/moon-${phase}-${state === "current" ? "cyan" : "lav"}.png`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static art asset, no optimizer pass wanted
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={
        state === "current"
          ? { filter: "drop-shadow(0 0 7px rgba(110, 232, 247, 0.55))" }
          : state === "future"
            ? { opacity: 0.45, filter: "saturate(0.55) brightness(0.85)" }
            : undefined
      }
    />
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
