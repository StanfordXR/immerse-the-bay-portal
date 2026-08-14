import Image from "next/image";
import { Brand } from "@/components/brand";
import { HeaderAuthLink } from "@/components/header-auth-link";
import { HeroCta } from "@/components/hero-cta";
import {
  closeDateLabel,
  finalDecisionsLabel,
  priorityDeadlineLabel,
  priorityDecisionsLabel,
} from "@/lib/config";

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
      note: "Reviewed as they arrive",
      state: "now" as const,
    },
    {
      date: priorityDeadlineLabel(),
      title: "Priority round closes",
      note: `Decisions by ${priorityDecisionsLabel()}`,
      state: "future" as const,
    },
    {
      date: closeDateLabel(),
      title: "Final round closes",
      note: `Decisions by ${finalDecisionsLabel()}`,
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
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden">
        <Image
          src="/skyline.jpg"
          alt=""
          fill
          priority
          unoptimized
          className="z-0 object-cover"
          style={{ objectPosition: "50% 78%" }}
          sizes="100vw"
        />
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{
            background: [
              // light vignette: edges settle, center stays open
              "radial-gradient(110% 85% at 50% 45%, transparent 48%, rgba(10,5,20,0.58) 100%)",
              "linear-gradient(180deg, rgba(10,5,20,0.78) 0%, rgba(10,5,20,0.55) 35%, rgba(10,5,20,0.42) 62%, rgba(10,5,20,0.68) 100%)",
            ].join(","),
          }}
        />

        {/* The nav floats directly on the render's sky: one image behind
            everything means no seam to hide at any viewport width. The
            hero overlay below already darkens the top for readability. */}
        <div className="relative z-[2] w-full">
          <header className="mx-auto flex w-full max-w-[96rem] items-center justify-between px-6 py-5 sm:px-8">
            <Brand />
            <nav className="flex items-center gap-4">
              <a
                href="https://immersethebay.org"
                className="text-[14px] text-moonlit/60 transition-colors hover:text-moonlit"
              >
                ← Back to main site
              </a>
              <HeaderAuthLink />
            </nav>
          </header>
        </div>

        <div className="relative z-[2] mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
          <div className="flex flex-1 flex-col items-center justify-center pb-14 pt-0 text-center sm:pb-20">
            <p className="eyebrow mb-5 !text-[13px]">
              November 13–15, 2026 · Stanford University
            </p>
            <h1 className="font-brand max-w-4xl text-balance text-4xl leading-[1.14] sm:text-6xl">
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
                Take me to the
              </span>{" "}
              <span
                style={{
                  color: "#ffffff",
                  textShadow: "0 0 24px rgba(236, 231, 251, 0.65)",
                }}
              >
                moon
              </span>
              .
            </h1>

            <div className="mt-9">
              <HeroCta />
            </div>
            <p className="mt-3.5 font-mono text-[13.5px] text-moonlit/70">
              under 10 minutes · auto-saves
            </p>
          </div>

          <div className="pb-16 sm:pb-24">
            <ol className="relative flex flex-col gap-7 sm:flex-row sm:gap-0">
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
                  className="relative flex-1 pl-7 sm:pl-0 sm:pr-4 sm:pt-4"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 size-3 rounded-full sm:top-0"
                    style={{
                      background:
                        item.state === "now" ? "var(--color-cyan)" : "rgba(30,22,64,0.9)",
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
                    className={`font-mono text-[12px] uppercase tracking-[0.12em] ${
                      item.state === "now" ? "text-cyan" : "text-moonlit/55"
                    }`}
                  >
                    {item.date}
                  </p>
                  <p className="mt-0.5 text-[15.5px] font-semibold text-moonlit">
                    {item.title}
                  </p>
                  <p className="text-[13.5px] text-moonlit/60">{item.note}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer sits inside the hero, directly on the render's ground. */}
        <footer className="relative z-[2]">
          <div
            className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-3 px-6 pb-5 pt-1 text-[13.5px] sm:px-8"
            style={{ color: "rgba(226, 218, 250, 0.66)" }}
          >
            <span>© 2026 Stanford XR</span>
            <div className="flex gap-5">
              <a href="/privacy" className="hover:text-moonlit">
                Privacy
              </a>
              <a href="mailto:admin@stanfordxr.org" className="hover:text-moonlit">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
