/**
 * Fixed atmospheric background: nebula glows, a static starfield, and
 * pixelated cyberpunk cubes drifting slowly downward (echoing the voxel
 * blocks on the main event site, immersethebay.org).
 *
 * Stars never move; only the cubes do, so the two read as different layers.
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
  [21, 11, 1.2, 0.65], [62, 8, 1.1, 0.6], [83, 24, 1.0, 0.5], [9, 47, 1.0, 0.4],
  [45, 30, 1.2, 0.55], [71, 52, 1.0, 0.4], [33, 66, 0.9, 0.3], [90, 44, 1.1, 0.45],
];

// Small pixel squares: distant debris, falling slowly. Sharp corners on
// purpose; round dots would read as loose stars.
const PIXELS: ReadonlyArray<readonly [number, number, number, number, string]> = [
  // [x%, size px, duration s, delay s, color]
  [6, 3, 74, 0, "#6ee8f7"], [14, 2, 96, 18, "#a99ce0"], [22, 2.5, 84, 39, "#e263f0"],
  [30, 2, 104, 9, "#6ee8f7"], [38, 3, 78, 27, "#a99ce0"], [46, 2, 112, 51, "#6ee8f7"],
  [54, 2.5, 88, 14, "#e263f0"], [62, 2, 100, 44, "#a99ce0"], [70, 3, 72, 31, "#6ee8f7"],
  [78, 2, 92, 5, "#a99ce0"], [86, 2.5, 82, 58, "#e263f0"], [94, 2, 108, 22, "#a99ce0"],
];

// Larger voxel outlines: nearer, so bigger and slightly faster, tumbling as
// they fall. [x%, size px, tilt deg, spin deg, duration s, delay s, hue]
const VOXELS: ReadonlyArray<
  readonly [number, number, number, number, number, number, "cyan" | "violet" | "magenta"]
> = [
  [10, 14, 12, 100, 84, 0, "cyan"],
  [26, 9, 33, -80, 102, 37, "violet"],
  [43, 18, 8, 70, 76, 62, "magenta"],
  [58, 8, 41, 120, 110, 18, "cyan"],
  [73, 11, 21, -95, 90, 80, "violet"],
  [90, 15, 15, 85, 96, 48, "cyan"],
];

const VOXEL_HUES = {
  cyan: { border: "rgba(110, 232, 247, 0.4)", fill: "rgba(110, 232, 247, 0.07)", glow: "rgba(110, 232, 247, 0.18)" },
  violet: { border: "rgba(169, 156, 224, 0.4)", fill: "rgba(139, 92, 246, 0.08)", glow: "rgba(139, 92, 246, 0.16)" },
  magenta: { border: "rgba(226, 99, 240, 0.35)", fill: "rgba(226, 99, 240, 0.06)", glow: "rgba(226, 99, 240, 0.15)" },
} as const;

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

      {/* falling pixel squares */}
      {PIXELS.map(([x, size, dur, delay, color], i) => (
        <span
          key={`p${i}`}
          className="nightscape-cube absolute"
          style={{
            left: `${x}%`,
            top: -8,
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 ${size * 2.5}px ${color}`,
            animationDuration: `${dur}s`,
            animationDelay: `${-delay}s`,
          }}
        />
      ))}

      {/* falling voxel outlines */}
      {VOXELS.map(([x, size, tilt, spin, dur, delay, hue], i) => {
        const c = VOXEL_HUES[hue];
        return (
          <span
            key={`v${i}`}
            className="nightscape-cube absolute"
            style={
              {
                left: `${x}%`,
                top: -40,
                width: size,
                height: size,
                border: `1px solid ${c.border}`,
                background: c.fill,
                boxShadow: `0 0 12px ${c.glow}, inset 0 0 8px ${c.glow}`,
                animationDuration: `${dur}s`,
                animationDelay: `${-delay}s`,
                "--tilt": `${tilt}deg`,
                "--spin": `${spin}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}

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
