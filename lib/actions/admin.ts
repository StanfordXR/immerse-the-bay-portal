"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getAuthorizedUser } from "@/lib/dal";
import { isRole } from "@/lib/permissions";

/**
 * Change another user's role. Goes through Better Auth's admin plugin
 * endpoint (not raw SQL) so the plugin's own permission checks and session
 * semantics apply. Any admin can change anyone except themselves; the
 * self-guard makes it impossible for the last admin to lock the team out.
 */
export async function setUserRole(
  userId: string,
  role: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  if (!isRole(role)) return { ok: false, error: "Unknown role." };
  if (userId === authz.user.id) {
    return { ok: false, error: "You cannot change your own role." };
  }

  try {
    await auth.api.setRole({
      body: { userId, role },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Role change failed. Try again." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
