import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Code of Conduct" };

/**
 * Public Code of Conduct, linked from the RSVP agreements (opens in a new
 * tab). Copied from the organizers' Google Doc; the doc's TL;DR is left out on
 * purpose so people read the whole thing. Keep in sync with the doc.
 */
export default function CodeOfConductPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
      </header>

      <article className="flex flex-col gap-7 pb-20 pt-4 text-[15px] leading-relaxed text-muted">
        <div>
          <p className="eyebrow mb-2">Immerse the Bay 2026</p>
          <h1 className="font-display text-3xl font-bold text-moonlit">Code of Conduct</h1>
        </div>

        <p>
          Stanford XR&apos;s Immerse the Bay Hackathon is dedicated to creating a welcoming,
          inclusive, and harassment-free environment where everyone can learn, build, and explore
          extended reality together.
        </p>
        <p>
          All participants, sponsors, mentors, judges, speakers, volunteers, organizers, and other
          attendees are expected to follow this Code of Conduct. It applies to event spaces,
          workshops, demonstrations, social activities, official online channels, and
          communications related to the hackathon.
        </p>

        <Section title="Expected behavior">
          <p>We ask everyone to:</p>
          <List
            items={[
              "Wear your badge or keep it visible at all times.",
              "Be considerate and respectful in your words and actions.",
              "Welcome people of all backgrounds, identities, abilities, and experience levels.",
              "Collaborate thoughtfully, share knowledge, and give constructive feedback.",
              "Respect personal boundaries, privacy, equipment, and shared spaces.",
              "Alert an organizer if you notice someone in distress, an unsafe situation, or a potential violation of this Code of Conduct.",
            ]}
          />
        </Section>

        <Section title="Harassment and unacceptable behavior">
          <p>
            Immerse the Bay does not tolerate harassment, discrimination, intimidation, or abuse.
            Unacceptable behavior includes:
          </p>
          <List
            items={[
              "Offensive or discriminatory comments related to gender, gender identity or expression, sexual orientation, disability, physical appearance, body size, age, race, ethnicity, nationality, language, religion, or socioeconomic background.",
              "Threats, deliberate intimidation, stalking, or persistent unwanted contact, whether in person or online.",
              "Unwelcome sexual attention, sexual comments, or inappropriate physical contact.",
              "Sexualized or discriminatory material in projects, presentations, demonstrations, clothing, or sponsor displays.",
              "Photographing or recording someone against their wishes, or sharing their personal information without permission.",
              "Sustained disruption of talks, workshops, demonstrations, or other event activities.",
              "Encouraging or retaliating against reports of any of the above behavior.",
            ]}
          />
          <p>
            These expectations apply equally to everyone, including sponsors, organizers, and others
            in positions of authority. Anyone asked to stop inappropriate behavior must comply
            immediately.
          </p>
        </Section>

        <Section title="XR demonstrations and equipment">
          <p>Immersive experiences require particular care for personal comfort, consent, and physical safety.</p>
          <List
            items={[
              "Explain an experience before someone participates, including potentially distressing content, flashing lights, intense motion, or other relevant effects.",
              "Ask before touching someone or helping them adjust a headset or other wearable equipment.",
              "Allow participants to pause, remove equipment, or leave an experience at any time without pressure.",
              "Keep demonstration areas clear of obstacles and follow equipment and venue safety instructions.",
              "Obtain permission before collecting or sharing recordings, spatial scans, or other participant data.",
              "Respect personal space and boundaries in virtual environments, including through avatars and virtual interactions.",
            ]}
          />
        </Section>

        <Section title="Photography and recording">
          <p>
            Photography and recording are welcome when participants&apos; privacy and preferences are
            respected. Give people a reasonable opportunity to decline, and comply with requests to
            stop recording them. Do not photograph or record people in bathrooms, designated resting
            areas, or other spaces where they reasonably expect privacy.
          </p>
        </Section>

        <Section title="Reporting a concern">
          <p>
            If you experience or witness harassment, feel unsafe, or have another concern, please
            contact an organizer in person or email{" "}
            <a href="mailto:admin@stanfordxr.org" className="text-cyan underline-offset-2 hover:underline">
              admin@stanfordxr.org
            </a>
            . You do not need to be certain that a violation occurred to raise a concern. If your
            concern involves an organizer, or you would prefer to speak with someone else, contact
            Victor Chen (
            <a href="mailto:victor36@stanford.edu" className="text-cyan underline-offset-2 hover:underline">
              victor36@stanford.edu
            </a>
            ).
          </p>
          <p>
            Organizers will handle reports respectfully and share information only as needed to
            respond, protect participants, or meet applicable obligations. You may bring someone you
            trust when making a report, and you will not be required to confront the person
            involved. Retaliation against anyone who raises a concern or assists with a report is
            prohibited.
          </p>
          <p>
            Organizers can help participants reach venue security, campus support, or emergency
            services. If you are in immediate danger or experiencing an emergency, call 911.
          </p>
        </Section>

        <Section title="Enforcement">
          <p>
            Organizers may take action appropriate to the circumstances, including asking someone to
            stop, issuing a warning, restricting participation, removing a participant from the
            event, disqualifying them from prizes, or contacting university officials or emergency
            services.
          </p>
          <p>Our priority is the safety and well-being of the Immerse the Bay community.</p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg font-semibold text-moonlit">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-faint">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
