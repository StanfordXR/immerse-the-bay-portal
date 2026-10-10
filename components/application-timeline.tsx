"use client";

import { useEffect, useMemo, useState } from "react";

export type TimelineItem = {
  date: string;
  title: string;
  note: string;
  at: number;
};

/**
 * Progresses evenly through each visual segment while using the real calendar
 * duration within that segment. This makes the line reach every milestone on
 * its actual date, even though the milestone cards are evenly spaced.
 */
export function segmentedProgress(now: number, milestones: number[]): number {
  if (milestones.length < 2 || now <= milestones[0]) return 0;
  const last = milestones.length - 1;
  if (now >= milestones[last]) return 1;

  for (let i = 1; i < milestones.length; i++) {
    if (now > milestones[i]) continue;
    const segmentStart = milestones[i - 1];
    const duration = milestones[i] - segmentStart;
    const withinSegment = duration > 0 ? (now - segmentStart) / duration : 1;
    return (i - 1 + withinSegment) / last;
  }
  return 1;
}

export function ApplicationTimeline({
  items,
  initialNow,
}: {
  items: TimelineItem[];
  initialNow: number;
}) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const initialRefresh = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 60 * 60 * 1000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, []);

  const progress = useMemo(
    () => segmentedProgress(now, items.map((item) => item.at)),
    [items, now],
  );

  return (
    <ol className="relative flex flex-col gap-7 sm:flex-row sm:gap-0">
      <span
        aria-hidden
        className="absolute bottom-14 left-[5px] top-1.5 w-px bg-line-2 sm:bottom-auto sm:left-0 sm:right-1/4 sm:top-[5px] sm:h-px sm:w-auto"
      >
        <span
          className="block w-full bg-cyan shadow-[0_0_10px_color-mix(in_oklab,var(--color-cyan)_55%,transparent)] transition-[height] duration-700 sm:h-full sm:transition-[width]"
          style={{ height: `${progress * 100}%`, width: `${progress * 100}%` }}
        />
      </span>

      {items.map((item) => {
        const reached = now >= item.at;
        return (
          <li key={item.title} className="relative flex-1 pl-7 sm:pl-0 sm:pr-4 sm:pt-4">
            <span
              aria-hidden
              className="absolute left-0 top-1.5 size-3 rounded-full transition-colors duration-500 sm:top-0"
              style={{
                background: reached ? "var(--color-cyan)" : "rgba(30,22,64,0.9)",
                border: `2px solid ${reached ? "var(--color-cyan)" : "var(--color-line-2)"}`,
                boxShadow: reached
                  ? "0 0 12px color-mix(in oklab, var(--color-cyan) 60%, transparent)"
                  : undefined,
              }}
            />
            <p
              className={`font-mono text-[12px] uppercase tracking-[0.12em] ${
                reached ? "text-cyan" : "text-moonlit/55"
              }`}
            >
              {item.date}
            </p>
            <p className="mt-0.5 text-[15.5px] font-semibold text-moonlit">{item.title}</p>
            <p className="text-[13.5px] text-moonlit/60">{item.note}</p>
          </li>
        );
      })}
    </ol>
  );
}
