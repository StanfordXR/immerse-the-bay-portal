import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  formatPacificDateTimeInput,
  parsePacificDateTimeInput,
} from "./pacific-time";

describe("Pacific datetime inputs", () => {
  test("parses a PDT deadline", () => {
    assert.equal(
      parsePacificDateTimeInput("2026-10-23T23:59")?.toISOString(),
      "2026-10-24T06:59:00.000Z",
    );
  });

  test("parses a PST deadline", () => {
    assert.equal(
      parsePacificDateTimeInput("2026-11-15T23:59")?.toISOString(),
      "2026-11-16T07:59:00.000Z",
    );
  });

  test("round-trips a stored deadline", () => {
    assert.equal(
      formatPacificDateTimeInput(new Date("2026-10-24T06:59:00.000Z")),
      "2026-10-23T23:59",
    );
  });

  test("rejects invalid and skipped local times", () => {
    assert.equal(parsePacificDateTimeInput("2026-02-31T12:00"), null);
    assert.equal(parsePacificDateTimeInput("2026-03-08T02:30"), null);
  });
});
