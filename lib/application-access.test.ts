import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canFinishAcceptedDraft } from "./application-access";

describe("closed application access", () => {
  test("allows only an accepted, unsubmitted draft", () => {
    assert.equal(
      canFinishAcceptedDraft({
        decision: "accepted",
        stage: "draft",
        submittedAt: null,
      }),
      true,
    );
  });

  test("does not reopen access for other application states", () => {
    assert.equal(canFinishAcceptedDraft(null), false);
    assert.equal(
      canFinishAcceptedDraft({
        decision: null,
        stage: "draft",
        submittedAt: null,
      }),
      false,
    );
    assert.equal(
      canFinishAcceptedDraft({
        decision: "waitlisted",
        stage: "draft",
        submittedAt: null,
      }),
      false,
    );
    assert.equal(
      canFinishAcceptedDraft({
        decision: "rejected",
        stage: "draft",
        submittedAt: null,
      }),
      false,
    );
    assert.equal(
      canFinishAcceptedDraft({
        decision: "accepted",
        stage: "submitted",
        submittedAt: new Date("2026-10-28T00:00:00Z"),
      }),
      false,
    );
    assert.equal(
      canFinishAcceptedDraft({
        decision: "accepted",
        stage: "decided",
        submittedAt: new Date("2026-10-28T00:00:00Z"),
      }),
      false,
    );
  });
});
