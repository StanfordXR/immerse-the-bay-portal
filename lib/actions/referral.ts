"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { getAuthorizedUser } from "@/lib/dal";

/** Toggle whether the caller's name appears on the referral leaderboard. */
export async function setReferralAnonymity(
  anonymous: boolean,
): Promise<{ ok: boolean }> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false };

  await db
    .update(application)
    .set({ referralAnonymous: anonymous })
    .where(
      and(
        eq(application.userId, authz.user.id),
        isNotNull(application.submittedAt),
      ),
    );

  revalidatePath("/dashboard");
  return { ok: true };
}
