import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { RSVP_DEADLINE, rsvpDeadlineLabel } from "@/lib/config";
import { rsvpFormSchema } from "@/lib/rsvp";

const validRsvp = {
  badgeName: "Vic",
  tshirtSize: "M",
  dietary: "None",
  pronouns: "they/them",
  phone: "",
  emergencyName: "Emergency Contact",
  emergencyEmail: "contact@example.com",
  emergencyPhone: "6505550100",
  agreements: {
    codeOfConduct: true,
    photoConsent: true,
    liability: true,
  },
};

describe("RSVP confirmation", () => {
  test("uses the shared October 16 deadline", () => {
    assert.equal(RSVP_DEADLINE.toISOString(), "2026-10-17T06:59:00.000Z");
    assert.equal(rsvpDeadlineLabel(), "Friday, October 16 at 11:59 PM PDT");
  });

  test("requires a printable badge name", () => {
    assert.equal(rsvpFormSchema.safeParse(validRsvp).success, true);
    assert.equal(rsvpFormSchema.safeParse({ ...validRsvp, badgeName: "  " }).success, false);
  });
});
