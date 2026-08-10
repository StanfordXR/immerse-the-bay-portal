import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/permissions";

/**
 * Data Access Layer — the *only* place authorization is decided.
 *
 * Next.js has shipped three middleware/proxy auth-bypass CVEs in eighteen months
 * (CVE-2025-29927, CVE-2026-44575, CVE-2026-45109), and Next's own docs warn
 * that Server Functions are POSTs to the route they live in, so a matcher change
 * can silently drop proxy coverage. Better Auth's docs make the same point about
 * cookie checks: the presence of a session cookie is not proof of a session.
 *
 * So: proxy.ts does redirects for UX, and every page, route handler and Server
 * Action calls one of these functions. That's the layer that has never been the
 * CVE.
 *
 * `cache()` dedupes the session lookup within a single request, so calling
 * requireUser() in both a layout and a page costs one query, not two.
 */

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getRole(): Promise<Role> {
  const user = await getCurrentUser();
  // Better Auth's admin plugin stores role on the user row; anyone without one
  // is an applicant. Defaulting closed matters — an unrecognised value must not
  // grant reviewer access.
  return user && isRole(user.role) ? user.role : "applicant";
}

export async function requireRole(...allowed: Role[]) {
  const user = await requireUser();
  const role = isRole(user.role) ? user.role : "applicant";
  if (!allowed.includes(role)) redirect("/");
  return { user, role };
}

/** Stanford XR members and admins. */
export async function requireReviewer() {
  return requireRole("reviewer", "admin");
}

export async function requireAdmin() {
  return requireRole("admin");
}

/**
 * For route handlers and Server Actions, where redirecting is the wrong
 * response. Returns null instead of navigating.
 */
export async function getAuthorizedUser(...allowed: Role[]) {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = isRole(user.role) ? user.role : "applicant";
  if (allowed.length > 0 && !allowed.includes(role)) return null;
  return { user, role };
}
