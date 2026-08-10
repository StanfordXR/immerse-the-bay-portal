/**
 * Fixed atmospheric background: nebula glows + a deterministic starfield.
 * Positions are literals (not Math.random) so server and client HTML match.
 * Pure CSS/SVG — no images, no motion, negligible paint cost.
 */

const STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  // [x%, y%, radius, opacity]
  [4, 8, 1.1, 0.7], [11, 22, 0.7, 0.4], [17, 5, 0.9, 0.6], [23, 15, 0.6, 0.35],
  [29, 9, 1.2, 0.75], [36, 19, 0.7, 0.4], [41, 4, 0.9, 0.55], [47, 12, 0.6, 0.4],
  [53, 7, 1.0, 0.65], [59, 17, 0.7, 0.35], [64, 3, 0.8, 0.5], [70, 13, 1.1, 0.7],
  [76, 6, 0.6, 0.4], [82, 18, 0.9, 0.55], [88, 9, 0.7, 0.45], [94, 14, 1.0, 0.6],
  [7, 34, 0.8, 0.45], [19, 41, 0.6, 0.3], [31, 37, 1.0, 0.55], [44, 44, 0.7, 0.35],
  [57, 39, 0.9, 0.5], [69, 42, 0.6, 0.3], [81, 36, 1.1, 0.6], [93, 43, 0.7, 0.4],
  [13, 58, 0.7, 0.3], [27, 63, 0.9, 0.4], [49, 57, 0.6, 0.28], [66, 61, 0.8, 0.35],
  [86, 59, 0.7, 0.3], [37, 72, 0.6, 0.22], [74, 76, 0.7, 0.25], [92, 71, 0.6, 0.22],
];

export function Nightscape() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* base sky */}
      <div className="absolute inset-0 bg-void" />

      {/* nebula fog — violet upper-left, magenta right, echoing the key art */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(60rem 34rem at 18% -6%, color-mix(in oklab, var(--color-violet) 16%, transparent), transparent 65%)",
            "radial-gradient(52rem 30rem at 88% 22%, color-mix(in oklab, var(--color-magenta) 11%, transparent), transparent 62%)",
            "radial-gradient(40rem 24rem at 55% 110%, color-mix(in oklab, var(--color-nebula) 18%, transparent), transparent 70%)",
          ].join(","),
        }}
      />

      {/* starfield */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        role="presentation"
      >
        {STARS.map(([x, y, r, o], i) => (
          <circle
            key={i}
            cx={`${x}%`}
            cy={`${y}%`}
            r={r}
            fill="#ece7fb"
            opacity={o}
          />
        ))}
      </svg>

      {/* lunar horizon — the curved ground plane from the art */}
      <div
        className="absolute -bottom-[46vw] left-1/2 h-[60vw] w-[160vw] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-violet) 26%, var(--color-abyss)) 0%, color-mix(in oklab, var(--color-nebula) 14%, var(--color-void)) 55%, transparent 100%)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}
