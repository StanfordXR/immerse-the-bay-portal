import { and, eq, inArray } from "drizzle-orm";
import { RSVP_DEADLINE } from "../lib/config";
import { db } from "../lib/db";
import { application } from "../lib/db/schema";

const apply = process.argv.includes("--apply");
const eligible = and(
  eq(application.stage, "decided"),
  eq(application.decision, "accepted"),
  inArray(application.rsvp, ["pending", "confirmed"]),
);

if (!apply) {
  const rows = await db
    .select({ id: application.id, deadline: application.rsvpDeadline })
    .from(application)
    .where(eligible);
  console.log({ apply: false, eligible: rows.length, deadline: RSVP_DEADLINE.toISOString() });
  process.exit(0);
}

const updated = await db
  .update(application)
  .set({ rsvpDeadline: RSVP_DEADLINE })
  .where(eligible)
  .returning({ id: application.id });

console.log({ apply: true, updated: updated.length, deadline: RSVP_DEADLINE.toISOString() });
