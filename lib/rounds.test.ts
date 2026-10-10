import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isPriority, planCutoff, planRelease } from "./rounds";

describe("decision rounds", () => {
  test("priority is based on first submission and excludes revisions", () => {
    const deadline = new Date("2026-10-01T00:00:00Z");
    assert.equal(isPriority({ firstSubmittedMs: deadline.getTime(), revisions: 0 }, deadline), true);
    assert.equal(isPriority({ firstSubmittedMs: deadline.getTime() + 1, revisions: 0 }, deadline), false);
    assert.equal(isPriority({ firstSubmittedMs: deadline.getTime(), revisions: 1 }, deadline), false);
  });

  test("cutoff skips incomplete reads, drafts, releases, and out-of-scope rows", () => {
    const rows = [
      { id: "accept", stage: "submitted", score: 4, reads: 2, under18: false, priority: true },
      { id: "partial", stage: "submitted", score: 4, reads: 1, under18: false, priority: true },
      { id: "minor", stage: "submitted", score: null, reads: 0, under18: true, priority: true },
      { id: "draft", stage: "draft", score: 5, reads: 2, under18: false, priority: true },
      { id: "regular", stage: "submitted", score: 5, reads: 2, under18: false, priority: false },
      { id: "released", stage: "decided", score: 5, reads: 2, under18: false, priority: true },
    ];
    assert.deepEqual(planCutoff(rows, { threshold: 3, readsTarget: 2, scope: "priority" }), {
      accepted: ["accept"], rejected: ["minor"], tooFewReads: ["partial"], unscored: [],
    });
  });

  test("release only includes marked decisions in scope", () => {
    assert.deepEqual(planRelease([
      { id: "a", decision: "accepted", priority: true },
      { id: "b", decision: "rejected", priority: false },
      { id: "c", decision: null, priority: true },
    ], "priority"), { accepted: ["a"], rejected: [] });
  });
});
