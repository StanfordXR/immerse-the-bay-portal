"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { getAuthorizedUser } from "@/lib/dal";

const feedbackSchema = z.object({
  deviceMethod: z.string().trim().max(300).optional().default(""),
  broke: z.string().trim().max(3000).optional().default(""),
  friction: z.string().trim().max(3000).optional().default(""),
  formNotes: z.string().trim().max(3000).optional().default(""),
  duration: z.string().trim().max(100).optional().default(""),
  mobileNotes: z.string().trim().max(3000).optional().default(""),
});

export async function submitFeedback(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await getAuthorizedUser();
  if (!authz) return { ok: false, error: "Sign in first so we can follow up." };

  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Something looked off. Try again." };

  const values = parsed.data;
  const hasContent = Object.values(values).some((v) => v.length > 0);
  if (!hasContent) return { ok: false, error: "Write at least one answer." };

  await db.insert(feedback).values({ userId: authz.user.id, ...values });
  return { ok: true };
}
