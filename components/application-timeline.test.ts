import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { segmentedProgress } from "./application-timeline";

describe("application timeline", () => {
  const milestones = [0, 100, 200, 300];

  test("reaches each evenly spaced visual milestone on its calendar date", () => {
    assert.equal(segmentedProgress(0, milestones), 0);
    assert.equal(segmentedProgress(100, milestones), 1 / 3);
    assert.equal(segmentedProgress(200, milestones), 2 / 3);
    assert.equal(segmentedProgress(300, milestones), 1);
  });

  test("moves proportionally within the current date segment and clamps at the ends", () => {
    assert.equal(segmentedProgress(-1, milestones), 0);
    assert.equal(segmentedProgress(150, milestones), 0.5);
    assert.equal(segmentedProgress(301, milestones), 1);
  });
});
