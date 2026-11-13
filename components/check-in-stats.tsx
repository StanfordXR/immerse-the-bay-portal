"use client";

import { useEffect, useState } from "react";
import type { CheckInStats } from "@/lib/check-in-types";

const refreshInterval = 30_000;
const formatArrival = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

export function CheckInStatsPanel({ revision }: { revision: number }) {
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [error, setError] = useState("");
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await fetch("/api/review/check-in", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (!response.ok) {
          if (controller.signal.aborted) return;
          if (response.status === 401 || response.status === 403) {
            setStats(null);
            setError("Sign back in as a reviewer or admin to see attendance.");
            return;
          }
          throw new Error("Attendance unavailable");
        }
        const data: CheckInStats = await response.json();
        if (!controller.signal.aborted) {
          setStats(data);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) setError("Couldn’t refresh attendance.");
      } finally {
        pending = false;
      }
    }
    void refresh();
    const poll = window.setInterval(refresh, refreshInterval);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [revision, manualRefresh]);

  const remaining = stats ? stats.confirmedHackers - stats.checkedInHackers : null;
  const percent = stats?.confirmedHackers
    ? Math.floor((100 * stats.checkedInHackers) / stats.confirmedHackers) : null;
  const metrics = [
    { label: "Hackers checked in", value: stats?.checkedInHackers, emphasize: true },
    { label: "Confirmed hackers", value: stats?.confirmedHackers },
    { label: "Hackers still due", value: remaining },
    { label: "Staff checked in", value: stats?.checkedInStaff },
  ];

  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="attendance-title">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="attendance-title" className="font-display text-lg font-semibold">Event attendance</h2>
        <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setManualRefresh((value) => value + 1)}>
          Refresh totals
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map(({ label, value, emphasize }) => (
          <div className="rounded-lg border border-line px-3 py-2" key={label}>
            <dt className="text-xs leading-snug text-muted">{label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${emphasize ? "text-ok" : ""}`}>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {percent !== null && (
        <div className="flex items-center gap-3">
          <progress className="h-2 min-w-0 flex-1 accent-ok" aria-label="Confirmed hackers checked in" value={stats?.checkedInHackers} max={stats?.confirmedHackers} />
          <span className="text-xs font-medium tabular-nums">{percent}% checked in</span>
        </div>
      )}
      <p className="text-xs text-muted" role="status">
        {error ? `${error}${stats ? " Showing last known totals." : ""}`
          : !stats ? "Loading attendance…"
          : stats.latestHackerCheckInAt
            ? `Latest hacker check-in: ${formatArrival.format(new Date(stats.latestHackerCheckInAt))}. Auto-refreshes every 30 seconds.`
            : "No hackers have checked in yet. Auto-refreshes every 30 seconds."}
      </p>
    </section>
  );
}
