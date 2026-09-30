import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { ReviewForm } from "@/components/review-form";
import { db } from "@/lib/db";
import { application, review } from "@/lib/db/schema";
import { requireReviewer } from "@/lib/dal";
import { draftSchema, HACKATHON_BUCKET_LABELS } from "@/lib/form-schema";

export const metadata: Metadata = { title: "Review" };

/**
 * One application, blind: no name, email, school, age or attribution, and no
 * other reviewer's scores. Reachable only through your own claim or review,
 * so reviewers can't browse the pool by URL.
 */
export default async function ReviewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireReviewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [mine] = await db
    .select()
    .from(review)
    .where(and(eq(review.applicationId, id), eq(review.reviewerId, user.id)))
    .limit(1);
  if (!mine) redirect("/review");

  const [row] = await db
    .select({
      answers: application.answers,
      gradYear: application.gradYear,
      hackathonsBucket: application.hackathonsBucket,
      primarySkill: application.primarySkill,
      portfolioUrl: application.portfolioUrl,
      resumeUrl: application.resumeUrl,
    })
    .from(application)
    .where(eq(application.id, id))
    .limit(1);
  if (!row) notFound();

  const parsed = draftSchema.safeParse(row.answers ?? {});
  const answers = parsed.success ? parsed.data : {};
  const skills = [...(answers.skills ?? []), answers.skillsOther].filter(Boolean);

  const initial =
    mine.submittedAt && mine.skills && mine.interest && mine.personality
      ? {
          skills: mine.skills,
          interest: mine.interest,
          personality: mine.personality,
          comment: mine.comment ?? "",
        }
      : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ REVIEW" />
        <Link href="/review" className="btn-ghost !py-2 text-[14px]">
          ← Queue
        </Link>
      </header>

      <div className="flex flex-col gap-6 pb-20 pt-2">
        <div>
          <p className="eyebrow mb-2">{initial ? "Editing your review" : "Blind read"}</p>
          <h1 className="font-display font-mono text-2xl font-semibold">
            #{id.slice(0, 8)}
          </h1>
        </div>

        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-4 text-[15px] font-semibold">Background</h2>
          <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[11rem_minmax(0,1fr)] [&_dd]:min-w-0 [&_dd]:break-words">
            <dt className="text-faint">Graduation</dt>
            <dd className="text-moonlit/90">{row.gradYear ?? "·"}</dd>
            <dt className="text-faint">Hackathons</dt>
            <dd className="text-moonlit/90">
              {row.hackathonsBucket
                ? (HACKATHON_BUCKET_LABELS[row.hackathonsBucket] ?? row.hackathonsBucket)
                : "·"}
            </dd>
            <dt className="text-faint">Primary skill</dt>
            <dd className="text-moonlit/90">{row.primarySkill ?? "·"}</dd>
            <dt className="text-faint">Skills</dt>
            <dd className="text-moonlit/90">{skills.join(", ") || "·"}</dd>
            <dt className="text-faint">Links</dt>
            <dd className="text-moonlit/90">{row.portfolioUrl || "·"}</dd>
            <dt className="text-faint">Resume</dt>
            <dd>
              {row.resumeUrl ? (
                <a
                  href={row.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan underline-offset-2 hover:underline"
                >
                  Open resume ↗
                </a>
              ) : (
                "·"
              )}
            </dd>
          </dl>
        </section>

        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-4 text-[15px] font-semibold">Story</h2>
          <h3 className="text-[13px] font-medium text-faint">
            Why do you want to be at Immerse the Bay, and what do you hope to get out of it?
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-moonlit/90 [overflow-wrap:anywhere]">
            {answers.whyParticipate || "·"}
          </p>
          <h3 className="mt-5 text-[13px] font-medium text-faint">
            If you could ask an XR industry CEO one question, what would it be?
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-moonlit/90 [overflow-wrap:anywhere]">
            {answers.ceoQuestion || "·"}
          </p>
        </section>

        <section className="card p-6 sm:p-7">
          <h2 className="font-display mb-5 text-[15px] font-semibold">Your scores</h2>
          <ReviewForm applicationId={id} initial={initial} />
        </section>
      </div>
    </main>
  );
}
