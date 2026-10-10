import { and, isNotNull, ne, sql } from "drizzle-orm";
import { application } from "./app-schema";

/**
 * Excludes applications owned by reviewers and admins.
 *
 * Core organizers create real applications while stress testing; once promoted
 * to reviewer their application must vanish from every applicant surface
 * (admin browser, stats, exports, the future review queue) without being
 * deleted, so their referral code and leaderboard presence keep working.
 * Use in WHERE clauses on queries selecting from `application`.
 */
export const applicantOwnedOnly = sql`not exists (
  select 1 from "user" staff
  where staff.id = ${application.userId}
    and coalesce(staff.role, 'applicant') <> 'applicant'
)`;

/** Keeps seeded login fixtures visible in admin browsing but out of real cohorts and exports. */
export const excludesTestAccounts = sql`not exists (
  select 1
  from "application_tag" test_assignment
  join "tag" test_tag on test_tag.id = test_assignment.tag_id
  where test_assignment.application_id = "application"."id"
    and test_tag.name = 'test-account'
)`;

export const decisionPoolOnly = and(applicantOwnedOnly, excludesTestAccounts);

/** Decision marked but not yet released: what the next release will publish. */
export const unreleasedDecision = and(
  isNotNull(application.decision),
  isNotNull(application.submittedAt),
  ne(application.stage, "decided"),
  applicantOwnedOnly,
);
