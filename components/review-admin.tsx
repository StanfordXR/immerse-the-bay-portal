"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { setReadsPerApplication } from "@/lib/actions/review";
import { MAX_READS_PER_APPLICATION, outcome, type Outcome } from "@/lib/review";

/** Reads-per-application picker on /admin/review. Saves on change. */
export function ReadsPerApplication({ initial }: { initial: number }) {
  const [reads, setReads] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: number) {
    const previous = reads;
    setReads(next);
    setError(null);
    startTransition(async () => {
      const result = await setReadsPerApplication(next).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (!result.ok) {
        setReads(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[14px]">
      <label htmlFor="reads" className="text-muted">
        Reads per application
      </label>
      <select
        id="reads"
        className="field !w-auto !py-1.5"
        value={reads}
        disabled={pending}
        onChange={(e) => save(Number(e.target.value))}
      >
        {Array.from({ length: MAX_READS_PER_APPLICATION }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[13px] text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export type ThresholdRow = {
  id: string;
  name: string;
  score: number | null;
  spread: number | null;
  reads: number;
  under18: boolean;
};

const OUTCOME_STYLE: Record<Outcome, string> = {
  accepted: "text-ok",
  rejected: "text-danger",
  unscored: "text-faint",
};

/**
 * Acceptance cutoff. Drag to see how many applications land on each side;
 * the export downloads exactly what's shown. Nothing is written to the
 * database — decisions are sent from the CSV.
 */
export function ThresholdPanel({ rows, reads }: { rows: ThresholdRow[]; reads: number }) {
  const [threshold, setThreshold] = useState(3);

  const counts = useMemo(() => {
    const c: Record<Outcome, number> = { accepted: 0, rejected: 0, unscored: 0 };
    for (const r of rows) c[outcome(r, threshold)]++;
    return c;
  }, [rows, threshold]);

  const scored = counts.accepted + counts.rejected;
  const partial = rows.filter((r) => r.reads > 0 && r.reads < reads).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <label htmlFor="threshold" className="font-display text-[15px] font-semibold">
            Accept at score ≥{" "}
            <span className="font-mono text-cyan">{threshold.toFixed(2)}</span>
          </label>
          <a
            href={`/admin/review/export?min=${threshold.toFixed(2)}`}
            className="btn-ghost !py-2 text-[14px]"
          >
            Export decisions CSV ↓
          </a>
        </div>
        <input
          id="threshold"
          type="range"
          min={1}
          max={5}
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full accent-cyan"
        />
        <dl className="grid grid-cols-3 gap-3">
          {(
            [
              [
                "Accepted",
                counts.accepted,
                scored ? `${Math.round((counts.accepted / scored) * 100)}% of scored` : "—",
              ],
              ["Rejected", counts.rejected, "incl. under 18"],
              ["Unscored", counts.unscored, "no reviews yet"],
            ] as const
          ).map(([label, value, sub]) => (
            <div key={label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                {label}
              </dt>
              <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
              <p className="text-[12px] text-faint">{sub}</p>
            </div>
          ))}
        </dl>
        {partial > 0 && (
          <p className="text-[13px] text-muted">
            {partial} scored application{partial === 1 ? " has" : "s have"} fewer than{" "}
            {reads} reads, so {partial === 1 ? "its" : "their"} score may still move.
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-140 text-[14px]">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-[0.13em] text-faint">
              <th className="px-4 py-3 font-normal">Applicant</th>
              <th className="px-4 py-3 text-right font-normal">Score</th>
              <th className="px-4 py-3 text-right font-normal">Reads</th>
              <th className="px-4 py-3 text-right font-normal">Spread</th>
              <th className="px-4 py-3 font-normal">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-faint">
                  No submitted applications yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const o = outcome(r, threshold);
              return (
                <tr key={r.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/applications/${r.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.score?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {r.reads} / {reads}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {r.spread === null || r.reads < 2 ? "—" : r.spread.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2.5 text-[13px] ${OUTCOME_STYLE[o]}`}>
                    {o}
                    {r.under18 && o === "rejected" ? " (under 18)" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
