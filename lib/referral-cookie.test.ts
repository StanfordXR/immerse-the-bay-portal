import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReferralCookie,
  REFERRAL_CODE_PATTERN,
  serializeReferralCookie,
} from "./referral-cookie";

test("referral codes use the same unambiguous six-character alphabet", () => {
  assert.equal(REFERRAL_CODE_PATTERN.test("abc234"), true);
  assert.equal(REFERRAL_CODE_PATTERN.test("abc1o0"), false);
  assert.equal(REFERRAL_CODE_PATTERN.test("ABC234"), false);
  assert.equal(REFERRAL_CODE_PATTERN.test("abc23"), false);
});

test("referral cookies round-trip their code, entry point and click time", () => {
  const value = {
    code: "abc234",
    entryPoint: "site" as const,
    clickedAt: 1_800_000_000_000,
  };

  assert.deepEqual(parseReferralCookie(serializeReferralCookie(value)), value);
});

test("malformed referral cookies are replaceable", () => {
  assert.equal(parseReferralCookie(undefined), null);
  assert.equal(parseReferralCookie("not-json"), null);
  assert.equal(
    parseReferralCookie(
      JSON.stringify({ code: "abc234", entryPoint: "other", clickedAt: 1 }),
    ),
    null,
  );
  assert.equal(
    parseReferralCookie(
      JSON.stringify({ code: "abc1o0", entryPoint: "site", clickedAt: 1 }),
    ),
    null,
  );
});
