import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, review, reviewConfig, user } from "@/lib/db/schema";
import { applicantOwnedOnly } from "@/lib/db/applicant-filter";
import { ageAtEvent } from "@/lib/config";
import { DEFAULT_READS_PER_APPLICATION, RUBRIC } from "@/lib/review";

/**
 * One review's weighted total, as SQL. Null for open claims (unscored rows).
 * Built from RUBRIC so it can't drift from the client-side `weightedScore`.
 */
export const reviewScoreSql = sql<number>`(${sql.join(
  RUBRIC.map((c) => sql`${c.weight}::numeric * ${review[c.key]}`),
  sql` + `,
)})`;

// Correlated subqueries for use in queries selecting from `application`.
// Qualified by hand: Drizzle renders ${application.id} unqualified in some
// positions, which is ambiguous inside a subquery.

/** Reads taken: submitted reviews plus open claims. What the queue fills against. */
export const readsTakenSql = sql<number>`(select count(*)::int from ${review} r where r.application_id = "application"."id")`;

/** Submitted reviews only. */
export const readsDoneSql = sql<number>`(select count(*)::int from ${review} r where r.application_id = "application"."id" and r.submitted_at is not null)`;

export async function getReadsPerApplication(): Promise<number> {
  const [row] = await db
    .select({ reads: reviewConfig.readsPerApplication })
    .from(reviewConfig)
    .where(eq(reviewConfig.id, 1))
    .limit(1);
  return row?.reads ?? DEFAULT_READS_PER_APPLICATION;
}

/**
 * Every submitted application with its aggregate score: the mean of submitted
 * reviews' weighted totals (null until the first review lands). Highest first,
 * unscored last. Admin-only data — names and emails included.
 */
export async function getReviewResults() {
  const rows = await db
    .select({
      id: application.id,
      firstName: application.firstName,
      lastName: application.lastName,
      email: user.email,
      schoolName: application.schoolName,
      dateOfBirth: application.dateOfBirth,
      reads: sql<number>`count(${review.id})::int`,
      score: sql<number | null>`avg(${reviewScoreSql})::float8`,
      spread: sql<number | null>`(max(${reviewScoreSql}) - min(${reviewScoreSql}))::float8`,
      comments: sql<string[]>`coalesce(array_agg(${review.comment}) filter (where ${review.comment} is not null), '{}')`,
    })
    .from(application)
    .innerJoin(user, eq(user.id, application.userId))
    .leftJoin(
      review,
      and(eq(review.applicationId, application.id), isNotNull(review.submittedAt)),
    )
    .where(and(isNotNull(application.submittedAt), applicantOwnedOnly))
    .groupBy(application.id, user.id)
    .orderBy(sql`avg(${reviewScoreSql}) desc nulls last`, desc(application.submittedAt));

  return rows.map(({ dateOfBirth, ...r }) => {
    const age = ageAtEvent(dateOfBirth);
    return { ...r, age, under18: age !== null && age < 18 };
  });
}

export type ReviewResult = Awaited<ReturnType<typeof getReviewResults>>[number];
