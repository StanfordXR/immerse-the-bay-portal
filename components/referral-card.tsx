"use client";

import { useState, useTransition } from "react";
import { setReferralAnonymity } from "@/lib/actions/referral";
import type { LeaderboardRow } from "@/lib/referral";

/**
 * Post-submit referral panel: personal link, anonymity toggle, leaderboard.
 * Rendered for applicants who have completed their own application, and for
 * reviewers/admins in leaderboard-only mode (code is null: no personal link,
 * no anonymity toggle, just the standings).
 */
export function ReferralCard({
  code,
  anonymous,
  top,
  you,
  baseUrl,
}: {
  code: string | null;
  anonymous: boolean;
  top: LeaderboardRow[];
  you: LeaderboardRow | null;
  baseUrl: string;
}) {
  const link = `${baseUrl}/r/${code ?? ""}`;
  const [copied, setCopied] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(anonymous);
  const [pending, startTransition] = useTransition();

  function copy() {
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleAnonymity(next: boolean) {
    setIsAnonymous(next);
    startTransition(async () => {
      const result = await setReferralAnonymity(next);
      if (!result.ok) setIsAnonymous(!next); // revert on failure
    });
  }

  const yourRank =
    you && you.count > 0
      ? top.findIndex((r) => r.isYou) + 1 || null
      : null;

  return (
    <section className="card overflow-hidden">
      {code && (
      <div className="border-b border-line p-6 sm:p-7">
        <h2 className="font-display text-xl font-semibold">
          Bring your friends
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          Share your link. Every friend who <em>completes</em> an application
          counts. Top referrers get shoutouts at the opening ceremony.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <code className="flex-1 truncate rounded-lg border border-line bg-abyss/70 px-3.5 py-2.5 font-mono text-[13.5px] text-cyan">
            {link}
          </code>
          <button type="button" className="btn-primary !py-2.5" onClick={copy}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted">
          <input
            type="checkbox"
            className="size-4 accent-[--color-cyan-2]"
            checked={isAnonymous}
            disabled={pending}
            onChange={(e) => toggleAnonymity(e.target.checked)}
          />
          Show me as &ldquo;Anonymous&rdquo; on the leaderboard
        </label>
      </div>
      )}

      <div className="p-6 sm:p-7">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-[15px] font-semibold">
            Referral leaderboard
          </h3>
          {you && (
            <span className="font-mono text-[12px] text-faint">
              you: {you.count} referral{you.count === 1 ? "" : "s"}
              {yourRank ? ` · #${yourRank}` : ""}
            </span>
          )}
        </div>

        {top.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-2 bg-abyss/40 p-5 text-center text-[14px] text-faint">
            No referrals yet. Share your link and claim the top spot. 🏆
          </p>
        ) : (
          <ol className="flex flex-col">
            {top.map((row, i) => (
              <li
                key={row.code}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  row.isYou ? "bg-cyan/10" : ""
                }`}
              >
                <span
                  className={`w-7 text-center font-mono text-[13px] ${
                    i === 0
                      ? "text-cyan"
                      : i < 3
                        ? "text-moonlit"
                        : "text-faint"
                  }`}
                >
                  {i === 0 ? "🏆" : `#${i + 1}`}
                </span>
                <span
                  className={`flex-1 truncate text-[14px] ${
                    row.isYou ? "font-semibold text-cyan" : "text-moonlit/90"
                  }`}
                >
                  {row.displayName}
                  {row.isYou && " (you)"}
                </span>
                <span className="font-mono text-[13px] tabular-nums text-muted">
                  {row.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
