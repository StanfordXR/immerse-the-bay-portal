import Link from "next/link";
import { Brand } from "@/components/brand";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { requireUser } from "@/lib/dal";
import {
  applicationsAreClosed,
  closeDateLabel,
  priorityDeadlineLabel,
} from "@/lib/config";
import { draftSchema, type Answers } from "@/lib/form-schema";
import { ApplyForm } from "@/components/apply-form";

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPage() {
  const user = await requireUser();

  const [row] = await db
    .select({
      answers: application.answers,
      submittedAt: application.submittedAt,
    })
    .from(application)
    .where(eq(application.userId, user.id))
    .limit(1);

  // Stored answers re-validated on the way out of the DB; a bad row degrades to
  // an empty form instead of a crash.
  const stored = draftSchema.safeParse(row?.answers ?? {});
  const initial: Answers = stored.success ? stored.data : {};

  // Prefill name from the OAuth profile — two fewer fields to type. Only for
  // clean two-word names: GitHub often reports a handle ("haoran-git-hub"),
  // and three-part names split wrong more often than right.
  if (!initial.firstName && !initial.lastName && user.name) {
    const parts = user.name.trim().split(/\s+/);
    const looksLikeHandle = /[\d_@\-.]/.test(user.name);
    if (parts.length === 2 && !looksLikeHandle) {
      initial.firstName = parts[0];
      initial.lastName = parts[1];
    }
  }

  const closed = applicationsAreClosed();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
        <Link href="/dashboard" className="btn-ghost !py-2 text-[14px]">
          Dashboard
        </Link>
      </header>

      <div className="pb-20 pt-4">
        <div className="mb-8">
          <p className="eyebrow mb-2">Application · 2026</p>
          <h1 className="font-display text-3xl font-bold">
            {row?.submittedAt ? "Edit your application" : "Your metamorphosis begins"}
          </h1>
          {!closed && (
            <p className="mt-2 text-[13.5px] text-faint">
              Priority round closes {priorityDeadlineLabel()}. Final deadline{" "}
              {closeDateLabel()}.
            </p>
          )}
        </div>

        {closed ? (
          <div className="card p-8 text-center">
            <p className="font-display text-lg font-semibold">
              Applications have closed
            </p>
            <p className="mt-2 text-[14.5px] text-muted">
              {row?.submittedAt
                ? "Your submitted application is safely in review — decisions go out by email in late October."
                : "We couldn't accept new applications this year, but the event site has ways to get involved."}
            </p>
          </div>
        ) : (
          <ApplyForm
            initialAnswers={initial}
            alreadySubmitted={Boolean(row?.submittedAt)}
            closeLabel={priorityDeadlineLabel()}
          />
        )}
      </div>
    </main>
  );
}
