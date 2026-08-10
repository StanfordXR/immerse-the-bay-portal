import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { closeDateLabel } from "@/lib/config";

const STAGES = [
  {
    n: "01",
    title: "Apply",
    when: `Open now — closes ${closeDateLabel()}`,
    body: "One application, about ten minutes. Your draft saves as you go.",
  },
  {
    n: "02",
    title: "Review",
    when: "Through October",
    body: "Every application is read by the Stanford XR team. All backgrounds and skill levels welcome.",
  },
  {
    n: "03",
    title: "Decisions",
    when: "Late October",
    body: "Acceptances by email, with waitlist waves as spots open up.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* ── hero over the key art ──────────────────────────────────────────── */}
      {/* `isolate` + explicit z-order: without it, Chrome composited the fixed
          Nightscape layer above this absolutely-positioned image. */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/skyline.jpg"
          alt=""
          fill
          priority
          unoptimized
          className="z-0 object-cover object-bottom"
          sizes="100vw"
        />
        {/* legibility + blend into the page ground */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,5,20,0.5) 0%, rgba(10,5,20,0.22) 35%, rgba(10,5,20,0.08) 62%, rgba(10,5,20,0.35) 86%, #0a0514 100%)",
          }}
        />

        <div className="relative z-[2] mx-auto w-full max-w-5xl px-6">
          <header className="flex items-center justify-between py-6">
            <Brand />
            <nav className="flex items-center gap-2">
              <a
                href="https://immersethebay.org"
                className="btn-ghost hidden !py-2 text-[14px] sm:inline-flex"
              >
                Event site ↗
              </a>
              <Link href="/sign-in" className="btn-ghost !py-2 text-[14px]">
                Sign in
              </Link>
            </nav>
          </header>

          <div className="flex flex-col items-center py-24 text-center sm:py-36">
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
            <p className="mt-6 max-w-xl text-balance text-[17px] leading-relaxed text-moonlit/85">
              Immerse the Bay is the Bay Area&apos;s leading XR hackathon — 36
              hours of building in AR, VR, and mixed reality with 300 hackers
              from around the world. Applications for 2026 are open.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/apply" className="btn-primary px-7 py-3 text-[16px]">
                Begin your application
              </Link>
              <span className="font-mono text-[12px] text-moonlit/60">
                ~10 minutes · autosaves
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── stats ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-6">
        <dl className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-12">
          {(
            [
              ["36", "hours of hacking"],
              ["300+", "hackers"],
              ["$150k+", "in XR equipment"],
              ["All levels", "welcome"],
            ] as const
          ).map(([stat, label]) => (
            <div key={label} className="text-center">
              <dt className="font-display text-xl font-semibold text-moonlit">
                {stat}
              </dt>
              <dd className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── how it works ───────────────────────────────────────────────────── */}
      <section
        aria-label="How it works"
        className="mx-auto w-full max-w-5xl px-6 pb-16"
      >
        <div className="neon-rule mb-10" />
        <ol className="grid gap-4 sm:grid-cols-3">
          {STAGES.map((stage) => (
            <li key={stage.title} className="card flex flex-col gap-3 p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-brand text-brand-gradient text-[22px]">
                  {stage.n}
                </span>
                <div>
                  <h2 className="font-display text-[16px] font-semibold">
                    {stage.title}
                  </h2>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
                    {stage.when}
                  </p>
                </div>
              </div>
              <p className="text-[14px] leading-relaxed text-muted">
                {stage.body}
              </p>
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
