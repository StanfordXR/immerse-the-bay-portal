import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  decisionRound,
  inScope,
  isPriority,
  normalizeTimestamp,
  planCutoff,
  planRelease,
} from "./rounds";

describe("decision rounds", () => {
  test("priority is based on first submission and excludes revisions", () => {
    const deadline = new Date("2026-10-01T00:00:00Z");
    assert.equal(isPriority({ firstSubmittedMs: deadline.getTime(), revisions: 0 }, deadline), true);
    assert.equal(isPriority({ firstSubmittedMs: deadline.getTime() + 1, revisions: 0 }, deadline), false);
    assert.equal(isPriority({ firstSubmittedMs: deadline.getTime(), revisions: 1 }, deadline), false);
  });

  test("computed database timestamps normalize from strings", () => {
    const iso = "2026-10-01T07:00:00.000Z";
    assert.equal(normalizeTimestamp(iso)?.toISOString(), iso);
    assert.equal(normalizeTimestamp(new Date(iso))?.toISOString(), iso);
    assert.equal(normalizeTimestamp("not-a-date"), null);
  });

  test("classifies priority, regular revisions, and late first submissions", () => {
    const priorityDeadline = new Date("2026-10-03T06:59:59Z");
    const regularDeadline = new Date("2026-10-17T06:59:59Z");
    assert.equal(
      decisionRound({ firstSubmittedMs: priorityDeadline.getTime(), revisions: 0 }, priorityDeadline, regularDeadline),
      "priority",
    );
    assert.equal(
      decisionRound({ firstSubmittedMs: priorityDeadline.getTime(), revisions: 1 }, priorityDeadline, regularDeadline),
      "regular",
    );
    assert.equal(
      decisionRound({ firstSubmittedMs: regularDeadline.getTime(), revisions: 0 }, priorityDeadline, regularDeadline),
      "regular",
    );
    assert.equal(
      decisionRound({ firstSubmittedMs: regularDeadline.getTime() + 1, revisions: 0 }, priorityDeadline, regularDeadline),
      "late",
    );
  });

  test("scopes keep all three rounds separate", () => {
    assert.equal(inScope("priority", "priority"), true);
    assert.equal(inScope("regular", "priority"), false);
    assert.equal(inScope("late", "late"), true);
    assert.equal(inScope("late", "regular"), false);
    assert.equal(inScope("priority", "all"), true);
    assert.equal(inScope("regular", "all"), true);
    assert.equal(inScope("late", "all"), true);
  });

  test("cutoff skips incomplete reads, drafts, releases, and out-of-scope rows", () => {
    const rows = [
      { id: "accept", stage: "submitted", score: 4, reads: 2, under18: false, round: "priority" as const },
      { id: "partial", stage: "submitted", score: 4, reads: 1, under18: false, round: "priority" as const },
      { id: "minor", stage: "submitted", score: null, reads: 0, under18: true, round: "priority" as const },
      { id: "draft", stage: "draft", score: 5, reads: 2, under18: false, round: "priority" as const },
      { id: "regular", stage: "submitted", score: 5, reads: 2, under18: false, round: "regular" as const },
      { id: "late", stage: "submitted", score: 5, reads: 2, under18: false, round: "late" as const },
      { id: "released", stage: "decided", score: 5, reads: 2, under18: false, round: "priority" as const },
    ];
    assert.deepEqual(planCutoff(rows, { threshold: 3, readsTarget: 2, scope: "priority" }), {
      accepted: ["accept"], rejected: ["minor"], tooFewReads: ["partial"], unscored: [],
    });
  });

  test("release only includes marked decisions in scope", () => {
    assert.deepEqual(planRelease([
      { id: "a", decision: "accepted", round: "priority" },
      { id: "b", decision: "rejected", round: "regular" },
      { id: "c", decision: null, round: "priority" },
    ], "priority"), { accepted: ["a"], rejected: [] });
    assert.deepEqual(planRelease([
      { id: "a", decision: "accepted", round: "priority" },
      { id: "b", decision: "rejected", round: "regular" },
      { id: "c", decision: null, round: "late" },
    ], "regular"), { accepted: [], rejected: ["b"] });
    assert.deepEqual(planRelease([
      { id: "a", decision: "accepted", round: "priority" },
      { id: "b", decision: "rejected", round: "regular" },
      { id: "c", decision: "accepted", round: "late" },
    ], "late"), { accepted: ["c"], rejected: [] });
  });
});
