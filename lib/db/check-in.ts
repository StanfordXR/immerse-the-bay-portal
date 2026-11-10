import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { application, applicationEvent, user } from "@/lib/db/schema";
import { decisionPoolOnly } from "@/lib/db/applicant-filter";
import type { CheckInPerson } from "@/lib/check-in-types";
import { STAFF_ROLES, type StaffRole } from "@/lib/permissions";

type Actor = { id: string; role: StaffRole };
type CheckInMethod = "search" | "qr";
const staffArrivalKind = "event_staff_checked_in";
const eligibility = and(
  decisionPoolOnly,
  isNotNull(application.submittedAt),
  eq(application.stage, "decided"),
  eq(application.decision, "accepted"),
  eq(application.rsvp, "confirmed"),
);
const applicationName = sql<string>`btrim(concat_ws(' ', ${application.firstName}, ${application.lastName}))`;
const fullName = sql<string>`coalesce(nullif(${applicationName}, ''), ${user.name})`;
const deskName = sql<string>`coalesce(nullif(btrim(${application.rsvpDetails}->>'badgeName'), ''), ${fullName})`;
const searchableName = sql`lower(concat_ws(' ', ${application.rsvpDetails}->>'badgeName', ${applicationName}, ${user.name}))`;

/** A stable event-scoped UUID lets the existing audit table deduplicate staff arrivals. */
function staffArrivalId(userId: string) {
  const bytes = createHash("sha256").update("itb2026/check-in/staff-arrival/v1\0").update(userId).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function roster(db: Pick<Db, "select">) {
  return db.select({
    id: application.id,
    name: deskName,
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
        .orderBy(asc(deskName), asc(application.id))
        .limit(15);
      return rows.map(forDesk);
    },

    async badgeForUser(userId: string) {
      const [row] = await db.select({ id: application.id, name: fullName })
        .from(application).innerJoin(user, eq(application.userId, user.id))
        .where(and(eligibility, eq(application.userId, userId)))
        .limit(1);
      return row ?? null;
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

    async checkInStaff(id: string, actor: Actor) {
      return db.transaction(async (tx) => {
        // Recheck the current role rather than trusting that an old badge still grants staff status.
        const [person] = await tx.select({ name: user.name, email: user.email })
          .from(user)
          .where(and(eq(user.id, id), inArray(user.role, [...STAFF_ROLES]), sql`${user.banned} is not true`))
          .limit(1)
          .for("share");
        if (!person) return null;
        const arrivalId = staffArrivalId(id);
        const [inserted] = await tx.insert(applicationEvent).values({
          id: arrivalId,
          actorId: actor.id,
          actorKind: actor.role,
          kind: staffArrivalKind,
          payload: { userId: id, method: "qr" },
        }).onConflictDoNothing({ target: applicationEvent.id }).returning({ at: applicationEvent.at });
        const checkedInAt = inserted?.at ?? (await tx.select({ at: applicationEvent.at })
          .from(applicationEvent)
          .where(and(eq(applicationEvent.id, arrivalId), eq(applicationEvent.kind, staffArrivalKind)))
          .limit(1))[0]?.at;
        return checkedInAt
          ? { person: forDesk({ id: arrivalId, ...person, checkedInAt }), alreadyCheckedIn: !inserted }
          : null;
      });
    },
  };
}
