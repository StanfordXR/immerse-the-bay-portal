import { test } from "node:test";
import assert from "node:assert/strict";
import { outcome } from "./review";

test("under-18s are rejected whether or not they've been scored", () => {
  assert.equal(outcome({ score: null, under18: true }, 3), "rejected");
  assert.equal(outcome({ score: 4.5, under18: true }, 3), "rejected");
  assert.equal(outcome({ score: null, under18: false }, 3), "unscored");
  assert.equal(outcome({ score: 3, under18: false }, 3), "accepted");
});
