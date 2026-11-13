import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import decodeQr from "jsqr";
import { create } from "qrcode";
import { createCheckInCode, createStaffCheckInCode, verifyBadgeCode, verifyCheckInCode } from "./check-in-badge";
import { createCheckInHandler, createCheckInStatsHandler } from "./check-in-handler";
import type { Db } from "./db";
import { createCheckInStore } from "./db/check-in";
import * as schema from "./db/schema";

const secret = "synthetic-itb-check-in-test-key";
const url = "https://portal.example.test/api/review/check-in";

test("a generated badge decodes from pixels and rejects wrong-event, tampered and truncated codes", () => {
  const id = randomUUID();
  const code = createCheckInCode(id, secret);
  assert.equal(verifyCheckInCode(code, secret), id);
  assert.equal(verifyCheckInCode(code, "other-key"), null);
  assert.equal(verifyCheckInCode(code.replace(id, randomUUID()), secret), null);
  assert.equal(verifyCheckInCode(code.slice(0, -1), secret), null);
  assert.equal(verifyCheckInCode(code + "\n", secret), null);
  assert.equal(verifyCheckInCode("https://example.test/", secret), null);
  assert.deepEqual(verifyBadgeCode(code, secret), { kind: "hacker", id });
  const staffId = "synthetic-opaque-staff-account";
  const staffCode = createStaffCheckInCode(staffId, secret);
  assert.deepEqual(verifyBadgeCode(staffCode, secret), { kind: "staff", id: staffId });
  assert.equal(verifyBadgeCode(staffCode, "other-key"), null);
  assert.equal(verifyBadgeCode(staffCode.replace(".staff.", "."), secret), null);

  const { modules } = create(code, { errorCorrectionLevel: "M" });
  const scale = 6;
  const border = 4;
  const width = (modules.size + border * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const offset = ((row + border) * scale * width + y * width + (col + border) * scale + x) * 4;
          pixels.fill(0, offset, offset + 3);
        }
      }
    }
  }
  assert.equal(decodeQr(pixels, width, width)?.data, code);
});

test("reviewer desk searches the confirmed roster and persists exactly one check-in per person", async () => {
  const pg = new PGlite();
  try {
    // The current schema includes tables added after the old migration snapshots.
    // Initialize the isolated database from the tracked schema.
    for (const statement of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) {
      await pg.exec(statement);
    }
    const db = drizzle(pg, { schema });
    // The SQL builder/transaction methods are shared across these Postgres drivers.
    const store = createCheckInStore(db as unknown as Db);
    const { user, application, tag, applicationTag, applicationEvent } = schema;
    const staff = { id: "fixture-reviewer", role: "reviewer" as const };
    const manualId = randomUUID();
    const scanId = randomUUID();
    const declinedId = randomUUID();
    const taggedId = randomUUID();
    const staffId = "fixture-admin";
    assert.deepEqual(await store.stats(), {
      confirmedHackers: 0, checkedInHackers: 0, checkedInStaff: 0, latestHackerCheckInAt: null,
    });
    await db.insert(user).values([
      { id: staff.id, name: "Fixture Reviewer", email: "staff@example.test", role: staff.role },
      { id: staffId, name: "Fixture Organizer", email: "organizer@example.test", role: "admin" },
      { id: "fixture-banned", name: "Banned Reviewer", email: "banned@example.test", role: "reviewer", banned: true },
      { id: "manual", name: "Avery Example", email: "avery@example.test", role: "applicant" },
      { id: "scan", name: "Robin Example", email: "robin@example.test", role: "applicant" },
      { id: "declined", name: "Declined Example", email: "declined@example.test", role: "applicant" },
      { id: "tagged", name: "Seeded Example", email: "seeded@example.test", role: "applicant" },
    ]);
    const accepted = { submittedAt: new Date(), stage: "decided", decision: "accepted", rsvp: "confirmed" } as const;
    await db.insert(application).values([
      { ...accepted, id: manualId, userId: "manual", firstName: "Avery", lastName: "Example" },
      { ...accepted, id: scanId, userId: "scan", firstName: "Robin", lastName: "Example" },
      { ...accepted, id: declinedId, userId: "declined", rsvp: "declined", checkedInAt: new Date() },
      { ...accepted, id: taggedId, userId: "tagged", checkedInAt: new Date() },
      { ...accepted, userId: staff.id, checkedInAt: new Date() },
    ]);
    const [fixtureTag] = await db.insert(tag).values({ name: "test-account" }).returning({ id: tag.id });
    await db.insert(applicationTag).values({ applicationId: taggedId, tagId: fixtureTag.id });

    function handler(authorized = true) {
      return createCheckInHandler({
        authorize: async () => authorized ? staff : null,
        search: store.search,
        checkIn: store.checkIn,
        checkInStaff: store.checkInStaff,
        verifyCode: (code) => verifyBadgeCode(code, secret),
      });
    }
    const api = handler();
    let statsReads = 0;
    const statsApi = (authorized = true, fail = false) => createCheckInStatsHandler({
      authorize: async () => authorized ? staff : null,
      stats: async () => {
        statsReads++;
        if (fail) throw new Error("do not expose database details");
        return store.stats();
      },
    })();
    function req(body: Record<string, unknown>, origin = new URL(url).origin) {
      return new Request(url, {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const anonymous = await handler(false)(req({ action: "search", query: "Example" }));
    assert.equal(anonymous.status, 403);
    assert.equal((await statsApi(false)).status, 403);
    assert.equal(statsReads, 0);
    const statsFailure = await statsApi(true, true);
    assert.equal(statsFailure.status, 503);
    assert.doesNotMatch(await statsFailure.text(), /database details/);
    const initialStats = await statsApi();
    assert.equal(initialStats.status, 200);
    assert.equal(initialStats.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await initialStats.json(), {
      confirmedHackers: 2, checkedInHackers: 0, checkedInStaff: 0, latestHackerCheckInAt: null,
    });
    const foreignOrigin = await api(req({ action: "manual", id: manualId }, "https://other.example.test"));
    assert.equal(foreignOrigin.status, 403);
    assert.equal((await api(req({ action: "scan", code: "invalid" }))).status, 400);
    assert.equal((await api(req({ action: "manual", id: declinedId }))).status, 404);
    assert.equal((await api(req({ action: "manual", id: taggedId }))).status, 404);
    assert.equal((await db.select().from(applicationEvent)).length, 0);

    const search = await api(req({ action: "search", query: " Example " }));
    assert.equal(search.status, 200);
    assert.equal(search.headers.get("cache-control"), "private, no-store");
    const roster = await search.json();
    assert.deepEqual(roster.people.map((p: { name: string }) => p.name), ["Avery Example", "Robin Example"]);
    assert.deepEqual(await store.search("%_"), []);
    assert.equal((await store.search("EXAMPLE AVERY"))[0].id, manualId);
    assert.equal((await store.search("AVERY@EXAMPLE.TEST"))[0].emailHint, "a…@example.test");
    assert.equal(await store.badgeForUser("tagged"), null);
    assert.deepEqual(await store.badgeForUser("scan"), { id: scanId, name: "Robin Example" });

    const [before] = await db.select({ updatedAt: application.updatedAt }).from(application).where(eq(application.id, manualId));
    const manual = await api(req({ action: "manual", id: manualId }));
    assert.equal(manual.status, 200);
    const first = await manual.json();
    assert.equal(first.alreadyCheckedIn, false);
    assert.ok(Date.parse(first.person.checkedInAt));
    const [after] = await db.select({ updatedAt: application.updatedAt }).from(application).where(eq(application.id, manualId));
    assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
    const badgeRequest = { action: "scan", code: createCheckInCode(scanId, secret) };
    const [firstScan, duplicate] = await Promise.all([api(req(badgeRequest)), api(req(badgeRequest))]);
    assert.equal(firstScan.status, 200);
    assert.equal(duplicate.status, 200);
    const readings = await Promise.all([firstScan.json(), duplicate.json()]);
    assert.deepEqual(readings.map((row) => row.alreadyCheckedIn).sort(), [false, true]);
    assert.equal(readings[0].person.checkedInAt, readings[1].person.checkedInAt);
    assert.equal((await store.search("Avery"))[0].checkedInAt, first.person.checkedInAt);

    // The desk preserves preferred RSVP names, but the private badge shows the full name.
    await db.update(application)
      .set({ rsvpDetails: sql`jsonb_build_object('badgeName', 'Fixture Nickname')` })
      .where(eq(application.id, scanId));
    assert.equal((await store.search("Fixture Nickname"))[0].name, "Fixture Nickname");
    assert.equal((await store.badgeForUser("scan"))?.name, "Robin Example");

    const scanStaff = { action: "scan", code: createStaffCheckInCode(staffId, secret) };
    assert.equal((await handler(false)(req(scanStaff))).status, 403);
    assert.equal((await api(req({ action: "scan", code: createStaffCheckInCode("manual", secret) }))).status, 404);
    assert.equal((await api(req({ action: "scan", code: createStaffCheckInCode("fixture-banned", secret) }))).status, 404);
    const [staffScan, staffRepeat] = await Promise.all([api(req(scanStaff)), api(req(scanStaff))]);
    assert.equal(staffScan.status, 200);
    assert.equal(staffRepeat.status, 200);
    const staffResults = await Promise.all([staffScan.json(), staffRepeat.json()]);
    assert.deepEqual(staffResults.map((row) => row.alreadyCheckedIn).sort(), [false, true]);
    assert.equal(staffResults[0].person.name, "Fixture Organizer");
    assert.equal(staffResults[0].person.checkedInAt, staffResults[1].person.checkedInAt);
    const staffAudit = await db.select().from(applicationEvent).where(eq(applicationEvent.kind, "event_staff_checked_in"));
    assert.equal(staffAudit.length, 1);
    assert.equal(staffAudit[0].applicationId, null);
    assert.deepEqual(staffAudit[0].payload, { userId: staffId, method: "qr" });
    const finalStats = await (await statsApi()).json();
    assert.deepEqual(finalStats, {
      confirmedHackers: 2,
      checkedInHackers: 2,
      checkedInStaff: 1,
      latestHackerCheckInAt: [first.person.checkedInAt, readings[0].person.checkedInAt].sort().at(-1),
    });
    await db.update(user).set({ role: "applicant" }).where(eq(user.id, staffId));
    assert.equal((await api(req(scanStaff))).status, 404);

    const audit = await db.select().from(applicationEvent).where(eq(applicationEvent.kind, "event_checked_in"));
    assert.equal(audit.length, 2);
    assert.ok(audit.every((event) => event.actorId === staff.id && event.actorKind === staff.role));
    assert.deepEqual(audit.map((event) => event.payload).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [
      { method: "qr" },
      { method: "search" },
    ]);
  } finally {
    await pg.close();
  }
});
