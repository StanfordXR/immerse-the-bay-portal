import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { ConfirmSpotForm } from "@/components/confirm-spot-form";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { requireUser } from "@/lib/dal";
import { draftSchema } from "@/lib/form-schema";

export const metadata: Metadata = { title: "Confirm your spot" };

/** Accepted hackers confirm (or edit) their RSVP here while the window is open. */
export default async function RsvpPage() {
  const user = await requireUser();

  const [row] = await db
    .select({
      answers: application.answers,
      tshirtSize: application.tshirtSize,
      dietaryNeeds: application.dietaryNeeds,
      rsvp: application.rsvp,
      details: application.rsvpDetails,
    })
    .from(application)
    .where(
      and(
        eq(application.userId, user.id),
        eq(application.stage, "decided"),
        eq(application.decision, "accepted"),
        inArray(application.rsvp, ["pending", "confirmed"]),
        gt(application.rsvpDeadline, new Date()),
      ),
    )
    .limit(1);
  if (!row) redirect("/dashboard");

  // Pronouns prefill from the application unless they've confirmed before.
  const parsed = draftSchema.safeParse(row.answers);
  const answers = parsed.success ? parsed.data : {};
  const appPronouns =
    answers.pronouns === "self-describe"
      ? (answers.pronounsSelf ?? "")
      : answers.pronouns === "prefer not to say"
        ? ""
        : (answers.pronouns ?? "");

  const details = row.details;
  const editing = row.rsvp === "confirmed";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
        <Link href="/dashboard" className="btn-ghost !py-2 text-[14px]">
          Dashboard
        </Link>
      </header>

      <div className="flex flex-col gap-6 pb-20 pt-4">
        <div>
          <p className="eyebrow mb-2">Immerse the Bay 2026</p>
          <h1 className="font-display text-3xl font-bold">
            {editing ? "Your RSVP details" : "Confirm your spot"}
          </h1>
          <p className="mt-2 text-[14.5px] text-muted">
            We prefilled what you told us in your application. Check it, add an emergency
            contact, and you&apos;re in.
          </p>
        </div>

        <ConfirmSpotForm
          editing={editing}
          initial={{
            tshirtSize: row.tshirtSize ?? "",
            dietary: row.dietaryNeeds ?? "",
            pronouns: details ? (details.pronouns ?? "") : appPronouns,
            phone: details?.phone ?? "",
            emergencyName: details?.emergencyContact.name ?? "",
            emergencyEmail: details?.emergencyContact.email ?? "",
            emergencyPhone: details?.emergencyContact.phone ?? "",
            agreements: {
              codeOfConduct: Boolean(details),
              photoConsent: Boolean(details),
              liability: Boolean(details),
            },
          }}
        />
      </div>
    </main>
  );
}
