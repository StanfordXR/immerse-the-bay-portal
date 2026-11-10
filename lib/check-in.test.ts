import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import decodeQr from "jsqr";
import { create } from "qrcode";
import { createCheckInCode, verifyCheckInCode } from "./check-in-badge";
import { createCheckInHandler } from "./check-in-handler";
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
    await db.insert(user).values([
      { id: staff.id, name: "Fixture Reviewer", email: "staff@example.test", role: staff.role },
      { id: "manual", name: "Avery Example", email: "avery@example.test", role: "applicant" },
      { id: "scan", name: "Robin Example", email: "robin@example.test", role: "applicant" },
      { id: "declined", name: "Declined Example", email: "declined@example.test", role: "applicant" },
      { id: "tagged", name: "Seeded Example", email: "seeded@example.test", role: "applicant" },
    ]);
    const accepted = { submittedAt: new Date(), stage: "decided", decision: "accepted", rsvp: "confirmed" } as const;
    await db.insert(application).values([
      { ...accepted, id: manualId, userId: "manual", firstName: "Avery", lastName: "Example" },
      { ...accepted, id: scanId, userId: "scan", firstName: "Robin", lastName: "Example" },
      { ...accepted, id: declinedId, userId: "declined", rsvp: "declined" },
      { ...accepted, id: taggedId, userId: "tagged" },
      { ...accepted, userId: staff.id },
    ]);
    const [fixtureTag] = await db.insert(tag).values({ name: "test-account" }).returning({ id: tag.id });
    await db.insert(applicationTag).values({ applicationId: taggedId, tagId: fixtureTag.id });

    function handler(authorized = true) {
      return createCheckInHandler({
        authorize: async () => authorized ? staff : null,
        search: store.search,
        checkIn: store.checkIn,
        verifyCode: (code) => verifyCheckInCode(code, secret),
      });
    }
    const api = handler();
    function req(body: Record<string, unknown>, origin = new URL(url).origin) {
      return new Request(url, {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const anonymous = await handler(false)(req({ action: "search", query: "Example" }));
    assert.equal(anonymous.status, 403);
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
