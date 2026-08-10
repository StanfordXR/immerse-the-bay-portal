import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Privacy" };

/**
 * DRAFT — needs a club officer's read before launch, especially the
 * sponsor-sharing paragraph. Plain-language by intent: the audience is
 * applicants, not lawyers.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
      </header>

      <article className="flex flex-col gap-7 pb-20 pt-4 text-[15px] leading-relaxed text-muted">
        <div>
          <p className="eyebrow mb-2">Immerse the Bay 2026</p>
          <h1 className="font-display text-3xl font-bold text-moonlit">
            Privacy policy
          </h1>
          <p className="mt-2 text-[13.5px] text-faint">
            Last updated August 9, 2026 · Stanford XR, a registered student
            organization at Stanford University
          </p>
        </div>

        <Section title="What we collect">
          <p>
            Your account details (name, email, and — if you sign in with Google
            or GitHub — your basic profile from that provider), everything you
            enter in the application form (including date of birth, school,
            skills, and your essays), an optional resume if you upload one, and
            how you found us — both your answer to the &ldquo;how did you hear
            about us&rdquo; question and the campaign link or QR code that first
            brought you to this site.
          </p>
        </Section>

        <Section title="Why">
          <p>
            To review applications and select attendees, to run the event
            (t-shirt sizes, dietary and accessibility needs), to email you about
            your application and the event, and to understand which outreach
            actually works so we plan next year better.
          </p>
        </Section>

        <Section title="Who sees it">
          <p>
            Stanford XR organizers and application reviewers. Reviewers see
            applications with names and demographic details hidden during the
            first review round.
          </p>
          <p>
            <strong className="text-moonlit">Sponsors:</strong> we share your
            resume and contact information with event sponsors{" "}
            <strong className="text-moonlit">
              only if you checked the separate sponsor-sharing box
            </strong>{" "}
            on the application. Leaving it unchecked has no effect on your
            application. We never sell your data.
          </p>
          <p>
            Service providers that host this portal process data on our behalf:
            Vercel (hosting and file storage), Neon (database), Resend (email),
            and PostHog (product analytics, with input masking enabled).
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Two first-party cookies: one that keeps you signed in, and one that
            remembers which link first brought you here. No third-party
            advertising or cross-site tracking.
          </p>
        </Section>

        <Section title="Eligibility">
          <p>
            Attendees must be 18 or older on November 13, 2026. Date of birth is
            used to verify this at acceptance. Applications from people under 18
            are not carried forward, and are deleted on request like any other
            application data.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep your application data until you ask us to remove it — this
            lets returning hackers keep their history across years. To have
            your data deleted, or to ask anything about it, email{" "}
            <a
              href="mailto:admin@stanfordxr.org"
              className="text-cyan underline-offset-2 hover:underline"
            >
              admin@stanfordxr.org
            </a>{" "}
            and a human will handle it. Aggregate statistics that can&apos;t
            identify anyone (like applicant counts by school or referral
            source) may be kept indefinitely to plan future events.
          </p>
        </Section>
      </article>

      <footer className="mt-auto border-t border-line py-6 text-[13px] text-faint">
        © 2026 Stanford XR
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg font-semibold text-moonlit">
        {title}
      </h2>
      {children}
    </section>
  );
}
