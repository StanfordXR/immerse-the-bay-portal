import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { closeDateLabel, priorityDeadlineLabel } from "@/lib/config";

/**
 * Deliberately minimal: the event site (immersethebay.org) carries the
 * marketing story. This page has two jobs — start an application, and show
 * the application timeline. Nothing else.
 */

export default function LandingPage() {
  const timeline = [
    {
      date: "August 14",
      title: "Applications open",
      note: "Rolling — apply any time",
      state: "now" as const,
    },
    {
      date: priorityDeadlineLabel(),
      title: "Priority round closes",
      note: "First decision wave",
      state: "future" as const,
    },
    {
      date: closeDateLabel(),
      title: "Final round closes",
      note: "Last day to apply",
      state: "future" as const,
    },
    {
      date: "Late October",
      title: "Decisions",
      note: "By email, in waves",
      state: "future" as const,
    },
    {
      date: "November 13–15",
      title: "Immerse the Bay",
      note: "Stanford University",
      state: "future" as const,
    },
  ];

  return (
    <main className="flex min-h-dvh flex-col">
      {/* `isolate` + explicit z-order: without it, Chrome composited the fixed
          Nightscape layer above this absolutely-positioned image. */}
      <section className="relative isolate flex flex-1 flex-col overflow-hidden">
        <Image
          src="/skyline.jpg"
          alt=""
          fill
          priority
          unoptimized
          className="z-0 object-cover object-bottom"
          sizes="100vw"
        />
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,5,20,0.5) 0%, rgba(10,5,20,0.22) 35%, rgba(10,5,20,0.08) 62%, rgba(10,5,20,0.35) 86%, #0a0514 100%)",
          }}
        />

        <div className="relative z-[2] mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
          <header className="flex items-center justify-between py-6">
            <Brand />
            <a
              href="https://immersethebay.org"
              className="btn-ghost !py-2 text-[14px]"
            >
              Event site ↗
            </a>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center sm:py-32">
            <p className="eyebrow mb-5">
              Stanford XR · November 13–15, 2026 · Stanford University
            </p>
            <h1 className="font-brand max-w-3xl text-balance text-3xl leading-[1.14] sm:text-5xl">
              Build the next{" "}
              <span
                className="text-glow-cyan"
                style={{
                  background:
                    "linear-gradient(100deg, var(--color-cyan) 10%, var(--color-magenta) 90%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                reality
              </span>
              .
            </h1>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/apply" className="btn-primary px-7 py-3 text-[16px]">
                Begin your application
              </Link>
              <Link href="/sign-in" className="btn-ghost px-6 py-3 text-[15px]">
                Sign in
              </Link>
            </div>
            <p className="mt-4 font-mono text-[12px] text-moonlit/60">
              under 10 minutes · auto-saves
            </p>
          </div>
        </div>
      </section>

      {/* ── the application timeline ───────────────────────────────────────── */}
      <section
        aria-label="Application timeline"
        className="mx-auto w-full max-w-5xl px-6 pb-14 pt-4"
      >
        <ol className="relative flex flex-col gap-7 sm:flex-row sm:gap-0">
          {/* connecting rail */}
          <span
            aria-hidden
            className="absolute left-[5px] top-1.5 h-[calc(100%-1rem)] w-px sm:left-0 sm:top-[5px] sm:h-px sm:w-full"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in oklab, var(--color-cyan) 60%, transparent), color-mix(in oklab, var(--color-magenta) 45%, transparent))",
            }}
          />
          {timeline.map((item) => (
            <li
              key={item.title}
              className="relative flex-1 pl-6 sm:pl-0 sm:pr-4 sm:pt-6"
            >
              <span
                aria-hidden
                className="absolute left-0 top-1.5 size-[11px] rounded-full sm:top-0"
                style={{
                  background:
                    item.state === "now" ? "var(--color-cyan)" : "var(--color-surface-2)",
                  border: `2px solid ${
                    item.state === "now" ? "var(--color-cyan)" : "var(--color-line-2)"
                  }`,
                  boxShadow:
                    item.state === "now"
                      ? "0 0 12px color-mix(in oklab, var(--color-cyan) 60%, transparent)"
                      : undefined,
                }}
              />
              <p
                className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
                  item.state === "now" ? "text-cyan" : "text-faint"
                }`}
              >
                {item.date}
              </p>
              <p className="mt-0.5 text-[14.5px] font-semibold text-moonlit">
                {item.title}
              </p>
              <p className="text-[13px] text-muted">{item.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-[13px] text-faint">
          <span>© 2026 Stanford XR</span>
          <div className="flex gap-5">
            <a href="https://immersethebay.org" className="hover:text-muted">
              immersethebay.org
            </a>
            <a href="/privacy" className="hover:text-muted">
              Privacy
            </a>
            <a href="mailto:admin@stanfordxr.org" className="hover:text-muted">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
