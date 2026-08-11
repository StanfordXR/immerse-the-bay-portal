import { sql } from "drizzle-orm";
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
