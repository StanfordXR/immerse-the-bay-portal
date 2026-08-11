import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, user } from "@/lib/db/schema";
import { applicantOwnedOnly } from "@/lib/db/applicant-filter";
import { getAuthorizedUser } from "@/lib/dal";
import { eq } from "drizzle-orm";

/** Full CSV export — admin only. The escape hatch until review tooling ships. */
export async function GET(): Promise<Response> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return new Response("Forbidden", { status: 403 });

  const rows = await db
    .select({
      submittedAt: application.submittedAt,
      createdAt: application.createdAt,
      firstName: application.firstName,
      lastName: application.lastName,
      email: user.email,
      dateOfBirth: application.dateOfBirth,
      schoolName: application.schoolName,
      schoolCountry: application.schoolCountry,
      schoolRegion: application.schoolRegion,
      gradYear: application.gradYear,
      hackathonsBucket: application.hackathonsBucket,
      priorAttendance: application.priorAttendance,
      primarySkill: application.primarySkill,
      portfolioUrl: application.portfolioUrl,
      tshirtSize: application.tshirtSize,
      dietaryNeeds: application.dietaryNeeds,
      accessibilityNeeds: application.accessibilityNeeds,
      resumeUrl: application.resumeUrl,
      sponsorShareOk: application.sponsorShareOk,
      heardAboutUs: application.heardAboutUs,
      heardAboutUsName: application.heardAboutUsName,
      utmSource: application.utmSource,
      utmMedium: application.utmMedium,
      utmCampaign: application.utmCampaign,
      utmContent: application.utmContent,
      referrer: application.referrer,
      answers: application.answers,
    })
    .from(application)
    .innerJoin(user, eq(application.userId, user.id))
    .where(applicantOwnedOnly)
    .orderBy(desc(application.submittedAt));

  const header = [
    "submitted_at", "created_at", "first_name", "last_name", "email",
    "date_of_birth", "school", "country", "region", "grad_year", "hackathons",
    "itb_before", "primary_skill", "portfolio", "tshirt", "dietary",
    "accessibility", "resume_url", "sponsor_share_ok", "heard_about_us",
    "heard_name", "utm_source",
    "utm_medium", "utm_campaign", "utm_content", "referrer",
    "why_participate", "ceo_question", "skills",
  ];

  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };

  const lines = [header.join(",")];
  for (const r of rows) {
    const answers = (r.answers ?? {}) as Record<string, unknown>;
    lines.push(
      [
        r.submittedAt?.toISOString() ?? "",
        r.createdAt.toISOString(),
        r.firstName, r.lastName, r.email, r.dateOfBirth,
        r.schoolName, r.schoolCountry, r.schoolRegion, r.gradYear,
        r.hackathonsBucket, r.priorAttendance, r.primarySkill, r.portfolioUrl,
        r.tshirtSize,
        r.dietaryNeeds, r.accessibilityNeeds, r.resumeUrl,
        r.sponsorShareOk ? "yes" : "no",
        r.heardAboutUs, r.heardAboutUsName,
        r.utmSource, r.utmMedium, r.utmCampaign, r.utmContent,
        r.referrer,
        answers.whyParticipate, answers.ceoQuestion,
        Array.isArray(answers.skills) ? answers.skills.join("; ") : "",
      ]
        .map(esc)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="itb-2026-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
