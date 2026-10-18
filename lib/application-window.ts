import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applicationConfig } from "@/lib/db/schema";
import { applicationsClose as environmentDeadline } from "@/lib/config";

export type ApplicationWindow = {
  /** The explicit admin switch, before the deadline is considered. */
  enabled: boolean;
  deadline: Date | null;
  /** True only when the switch is on and the deadline has not passed. */
  accepting: boolean;
  source: "database" | "environment";
};

export function isAcceptingApplications(
  enabled: boolean,
  deadline: Date | null,
  now = new Date(),
): boolean {
  return enabled && deadline !== null && now.getTime() <= deadline.getTime();
}

/**
 * Runtime application intake state. Until an admin saves the first setting,
 * the existing deployment deadline remains the fallback so this migration is
 * backwards-compatible.
 */
export async function getApplicationWindow(): Promise<ApplicationWindow> {
  const [row] = await db
    .select({
      enabled: applicationConfig.applicationsOpen,
      deadline: applicationConfig.applicationsClose,
    })
    .from(applicationConfig)
    .where(eq(applicationConfig.id, 1))
    .limit(1);

  const enabled = row?.enabled ?? true;
  const deadline = row?.deadline ?? environmentDeadline();

  return {
    enabled,
    deadline,
    accepting: isAcceptingApplications(enabled, deadline),
    source: row ? "database" : "environment",
  };
}
