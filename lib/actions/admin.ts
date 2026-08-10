"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { application, applicationEvent, applicationTag, tag } from "@/lib/db/schema";
import { getAuthorizedUser } from "@/lib/dal";
import { isRole } from "@/lib/permissions";

type Result = { ok: boolean; error?: string };

/**
 * Change another user's role. Goes through Better Auth's admin plugin
 * endpoint (not raw SQL) so the plugin's own permission checks and session
 * semantics apply. Any admin can change anyone except themselves; the
 * self-guard makes it impossible for the last admin to lock the team out.
 */
export async function setUserRole(userId: string, role: string): Promise<Result> {
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

/* ── tags ──────────────────────────────────────────────────────────────── */

const TAG_NAME_MAX = 40;

function normalizeTagName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > TAG_NAME_MAX) return null;
  return name;
}

export async function createTag(rawName: string): Promise<Result> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  const name = normalizeTagName(rawName);
  if (!name) return { ok: false, error: `1 to ${TAG_NAME_MAX} characters.` };

  try {
    await db.insert(tag).values({ name, createdBy: authz.user.id });
  } catch {
    return { ok: false, error: "A tag with that name already exists." };
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function renameTag(tagId: string, rawName: string): Promise<Result> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  const name = normalizeTagName(rawName);
  if (!name) return { ok: false, error: `1 to ${TAG_NAME_MAX} characters.` };

  try {
    await db.update(tag).set({ name }).where(eq(tag.id, tagId));
  } catch {
    return { ok: false, error: "A tag with that name already exists." };
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function setTagArchived(
  tagId: string,
  archived: boolean,
): Promise<Result> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };
  await db.update(tag).set({ archived }).where(eq(tag.id, tagId));
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function toggleApplicationTag(
  applicationId: string,
  tagId: string,
  on: boolean,
): Promise<Result> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };

  if (on) {
    await db
      .insert(applicationTag)
      .values({ applicationId, tagId, addedBy: authz.user.id })
      .onConflictDoNothing();
  } else {
    await db
      .delete(applicationTag)
      .where(
        and(
          eq(applicationTag.applicationId, applicationId),
          eq(applicationTag.tagId, tagId),
        ),
      );
  }

  await db.insert(applicationEvent).values({
    applicationId,
    actorId: authz.user.id,
    actorKind: "admin",
    kind: on ? "tag_added" : "tag_removed",
    payload: { tagId },
  });

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/admin/applications");
  return { ok: true };
}

/* ── decisions ─────────────────────────────────────────────────────────── */

const DECISIONS = ["accepted", "waitlisted", "rejected"] as const;
type Decision = (typeof DECISIONS)[number];

/**
 * Record a decision on one application. This only *marks* the decision;
 * nothing is emailed. Release (the irreversible send) is a separate flow
 * that doesn't exist yet, by design.
 */
export async function setDecision(
  applicationId: string,
  decision: string,
  note: string,
): Promise<Result> {
  const authz = await getAuthorizedUser("admin");
  if (!authz) return { ok: false, error: "Not authorized." };

  const clearing = decision === "none";
  if (!clearing && !DECISIONS.includes(decision as Decision)) {
    return { ok: false, error: "Unknown decision." };
  }
  const trimmedNote = note.trim().slice(0, 2000);

  await db
    .update(application)
    .set(
      clearing
        ? { decision: null, decidedAt: null, decisionNote: trimmedNote || null }
        : {
            decision: decision as Decision,
            decidedAt: new Date(),
            decisionNote: trimmedNote || null,
          },
    )
    .where(eq(application.id, applicationId));

  await db.insert(applicationEvent).values({
    applicationId,
    actorId: authz.user.id,
    actorKind: "admin",
    kind: clearing ? "decision_cleared" : "decision_set",
    payload: { decision: clearing ? null : decision, note: trimmedNote },
  });

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/admin/applications");
  return { ok: true };
}
