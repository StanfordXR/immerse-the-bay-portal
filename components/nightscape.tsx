/**
 * Fixed atmospheric background: nebula glows, a static starfield, and slowly
 * drifting particles (matching the main event site's ambient motion).
 *
 * All positions and timings are literals so server and client HTML match.
 * Animations are transform/opacity only (compositor-friendly) and are
 * disabled globally under prefers-reduced-motion.
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

// Twinkling stars: a subset pulses gently on long offsets.
const TWINKLES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  // [x%, y%, radius, duration s, delay s]
  [21, 11, 1.2, 5.5, 0], [62, 8, 1.1, 7, 1.6], [83, 24, 1.0, 6, 3.1],
  [9, 47, 1.0, 8, 0.9], [45, 30, 1.2, 6.5, 2.4], [71, 52, 1.0, 7.5, 4.2],
  [33, 66, 0.9, 9, 1.2], [90, 44, 1.1, 6.8, 5.0],
];

// Drifting particles: rise slowly and loop, like dust in the city lights.
const PARTICLES: ReadonlyArray<readonly [number, number, number, number, string]> = [
  // [x%, size px, duration s, delay s, color]
  [8, 3, 68, 0, "#6ee8f7"], [16, 2, 84, 12, "#a99ce0"], [24, 2.5, 76, 31, "#e263f0"],
  [33, 2, 92, 7, "#6ee8f7"], [41, 3, 71, 22, "#a99ce0"], [52, 2, 88, 40, "#6ee8f7"],
  [60, 2.5, 79, 15, "#e263f0"], [68, 2, 95, 3, "#a99ce0"], [77, 3, 66, 27, "#6ee8f7"],
  [85, 2, 82, 36, "#a99ce0"], [93, 2.5, 74, 9, "#e263f0"], [47, 2, 100, 50, "#a99ce0"],
];

export function Nightscape() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* base sky */}
      <div className="absolute inset-0 bg-void" />

      {/* nebula fog: violet upper-left, magenta right, cyan pocket low-left */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(60rem 34rem at 18% -6%, color-mix(in oklab, var(--color-violet) 18%, transparent), transparent 65%)",
            "radial-gradient(52rem 30rem at 88% 22%, color-mix(in oklab, var(--color-magenta) 13%, transparent), transparent 62%)",
            "radial-gradient(36rem 22rem at 8% 88%, color-mix(in oklab, var(--color-cyan) 8%, transparent), transparent 70%)",
            "radial-gradient(40rem 24rem at 55% 110%, color-mix(in oklab, var(--color-nebula) 20%, transparent), transparent 70%)",
          ].join(","),
        }}
      />

      {/* static starfield */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="presentation">
        {STARS.map(([x, y, r, o], i) => (
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#ece7fb" opacity={o} />
        ))}
      </svg>

      {/* twinkling stars */}
      {TWINKLES.map(([x, y, r, dur, delay], i) => (
        <span
          key={`t${i}`}
          className="nightscape-twinkle absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: r * 2.4,
            height: r * 2.4,
            background: "#ece7fb",
            boxShadow: "0 0 6px rgba(236, 231, 251, 0.8)",
            animationDuration: `${dur}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}

      {/* drifting particles */}
      {PARTICLES.map(([x, size, dur, delay, color], i) => (
        <span
          key={`p${i}`}
          className="nightscape-particle absolute rounded-full"
          style={{
            left: `${x}%`,
            bottom: -8,
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 ${size * 3}px ${color}`,
            animationDuration: `${dur}s`,
            animationDelay: `${-delay}s`,
          }}
        />
      ))}

      {/* lunar horizon */}
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
