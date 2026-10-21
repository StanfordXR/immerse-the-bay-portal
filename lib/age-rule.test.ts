import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { blockedByAgeRule, isStanfordAffiliated } from "@/lib/config";

describe("18+ rule with Stanford exemption", () => {
  test("blocks a non-Stanford applicant under 18 on Nov 13", () => {
    assert.equal(blockedByAgeRule("2010-08-04", { email: "a@gmail.com", school: "TJHSST" }), true);
  });
  test("exempts stanford.edu accounts and Stanford schools", () => {
    assert.equal(blockedByAgeRule("2008-12-20", { email: "x@stanford.edu", school: "Stanford University" }), false);
    assert.equal(blockedByAgeRule("2008-12-20", { email: "x@gmail.com", school: "Stanford" }), false);
    assert.equal(isStanfordAffiliated("x@notstanford.edu.evil.com", "Stanford Online High School"), false);
  });
  test("adults and unknown birth dates are never blocked", () => {
    assert.equal(blockedByAgeRule("2000-01-01", { email: "a@gmail.com" }), false);
    assert.equal(blockedByAgeRule(null, { email: "a@gmail.com" }), false);
  });
});
