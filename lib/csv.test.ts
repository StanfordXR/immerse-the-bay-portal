import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv";

test("neutralizes formulas and quotes as needed", () => {
  assert.equal(
    toCsv(["a", "b", "c"], [['=HYPERLINK("x")', "-1+2", null], ["Jane, Doe", 3, "@sum"]]),
    'a,b,c\n"\'=HYPERLINK(""x"")",\'-1+2,\n"Jane, Doe",3,\'@sum',
  );
});
