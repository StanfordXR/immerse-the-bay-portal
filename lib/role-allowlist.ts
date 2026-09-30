import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { isRole, ROLE_VALUES, type Role } from "@/lib/permissions";

/**
 * Staff roles granted by email, from comma-separated env vars. Lives in Vercel
 * env rather than in code because this repo is public — organiser addresses
 * must never be committed.
 *
 *   ADMIN_EMAILS="a@stanford.edu, b@gmail.com"
 *   REVIEWER_EMAILS="c@stanford.edu"
 *
 * No `server-only` import: lib/auth.ts pulls this in, and the Better Auth CLI
 * loads lib/auth.ts outside Next.
 */
function emailsFrom(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function allowlistedRole(email: string): Role | null {
  const normalized = email.toLowerCase();
  if (emailsFrom("ADMIN_EMAILS").has(normalized)) return "admin";
  if (emailsFrom("REVIEWER_EMAILS").has(normalized)) return "reviewer";
  return null;
}

const rank = (role: Role) => ROLE_VALUES.indexOf(role);

/**
 * Called after every new session. Promotes an allowlisted user to their
 * listed role; never demotes, so a role granted by hand in /admin/users
 * survives an allowlist that doesn't mention the user.
 *
 * Only verified emails count. Email/password sign-up doesn't require
 * verification, so without this anyone could register as an organiser's
 * address and inherit their role. Google and GitHub sign-ins arrive verified;
 * email/password staff still get promoted by hand.
 */
export async function applyRoleAllowlist(u: {
  id: string;
  email: string;
  emailVerified: boolean;
  role?: string | null;
}) {
  if (!u.emailVerified) return;
  const listed = allowlistedRole(u.email);
  if (!listed) return;
  const current = isRole(u.role) ? u.role : "applicant";
  if (rank(listed) <= rank(current)) return;
  // A failed promotion must not fail the sign-in; an admin can fix it by hand.
  try {
    await db.update(user).set({ role: listed }).where(eq(user.id, u.id));
  } catch (err) {
    console.error("[auth] role allowlist promotion failed", err);
  }
}
