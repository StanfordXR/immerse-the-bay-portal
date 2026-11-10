import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { application, applicationEvent, user } from "@/lib/db/schema";
import { decisionPoolOnly } from "@/lib/db/applicant-filter";
import type { CheckInPerson } from "@/lib/check-in-types";

type Actor = { id: string; role: "reviewer" | "admin" };
type CheckInMethod = "search" | "qr";
const eligibility = and(
  decisionPoolOnly,
  isNotNull(application.submittedAt),
  eq(application.stage, "decided"),
  eq(application.decision, "accepted"),
  eq(application.rsvp, "confirmed"),
);
const applicationName = sql<string>`btrim(concat_ws(' ', ${application.firstName}, ${application.lastName}))`;
const badgeName = sql<string>`coalesce(nullif(btrim(${application.rsvpDetails}->>'badgeName'), ''), nullif(${applicationName}, ''), ${user.name})`;
const searchableName = sql`lower(concat_ws(' ', ${badgeName}, ${applicationName}, ${user.name}))`;

function roster(db: Pick<Db, "select">) {
  return db.select({
    id: application.id,
    name: badgeName,
    email: user.email,
    checkedInAt: application.checkedInAt,
  }).from(application).innerJoin(user, eq(application.userId, user.id));
}

function forDesk(row: {
  id: string;
  name: string;
  email: string;
  checkedInAt: Date | null;
}): CheckInPerson {
  const at = row.email.lastIndexOf("@");
  const emailHint = at > 0 ? `${Array.from(row.email)[0]}…${row.email.slice(at)}` : "";
  return {
    id: row.id,
    name: row.name,
    emailHint,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
  };
}

export function createCheckInStore(db: Pick<Db, "select" | "transaction">) {
  return {
    async search(rawQuery: string) {
      const query = rawQuery.trim().toLowerCase();
      if (query.length < 2 || query.length > 100) return [];
      // Literal name fragments, in either order. Email addresses must match exactly.
      const match = query.includes("@")
        ? sql`lower(${user.email}) = ${query}`
        : and(...query.split(/\s+/).map((word) => sql`strpos(${searchableName}, ${word}) > 0`));
      const rows = await roster(db)
        .where(and(eligibility, match))
        .orderBy(asc(badgeName), asc(application.id))
        .limit(15);
      return rows.map(forDesk);
    },

    async badgeForUser(userId: string) {
      const [row] = await roster(db)
        .where(and(eligibility, eq(application.userId, userId)))
        .limit(1);
      return row ? { id: row.id, name: row.name } : null;
    },

    async checkIn(id: string, actor: Actor, method: CheckInMethod) {
      return db.transaction(async (tx) => {
        // A conditional update locks the row. A repeat scan or second desk cannot
        // change the original check-in time or add a second audit event.
        const [updated] = await tx.update(application)
          .set({ checkedInAt: sql`now()`, updatedAt: sql`${application.updatedAt}` })
          .where(and(eligibility, eq(application.id, id), isNull(application.checkedInAt)))
          .returning({ id: application.id });

        if (updated) {
          await tx.insert(applicationEvent).values({
            applicationId: updated.id,
            actorId: actor.id,
            actorKind: actor.role,
            kind: "event_checked_in",
            payload: { method },
          });
        }

        const [row] = await roster(tx).where(and(eligibility, eq(application.id, id))).limit(1);
        return row?.checkedInAt ? { person: forDesk(row), alreadyCheckedIn: !updated } : null;
      });
    },
  };
}
