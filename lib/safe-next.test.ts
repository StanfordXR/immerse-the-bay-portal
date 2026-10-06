import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safe-next";

test("keeps our own paths", () => {
  assert.equal(safeNext("/dashboard?tab=1#x"), "/dashboard?tab=1#x");
  assert.equal(safeNext("/apply"), "/continue");
  assert.equal(safeNext(null), "/continue");
});

test("never leaves our origin", () => {
  for (const raw of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "javascript:alert(1)"]) {
    assert.equal(safeNext(raw), "/continue", raw);
  }
});
