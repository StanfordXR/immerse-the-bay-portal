import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset-existing");
const OUTPUT = ".test-accounts.local.json";

const fixtures = [
  {
    email: "admin+itb-accepted@stanfordxr.org",
    name: "ITB Accepted Tester",
    firstName: "Accepted",
    lastName: "Tester",
    dateOfBirth: "2000-01-01",
    decision: "accepted" as const,
    rsvp: "pending" as const,
  },
  {
    email: "admin+itb-rejected@stanfordxr.org",
    name: "ITB Rejected Tester",
    firstName: "Rejected",
    lastName: "Tester",
    dateOfBirth: "2000-01-01",
    decision: "rejected" as const,
    rsvp: null,
  },
  {
    email: "admin+itb-under18@stanfordxr.org",
    name: "ITB Under-18 Tester",
    firstName: "Under-18",
    lastName: "Tester",
    dateOfBirth: "2010-01-01",
    decision: "rejected" as const,
    rsvp: null,
  },
];

if (!APPLY) {
  console.log("Dry run only. No database writes were made.");
  console.table(fixtures.map(({ email, decision, rsvp }) => ({ email, decision, rsvp: rsvp ?? "none" })));
  console.log("Run with --apply to create missing fixtures. Add --reset-existing only to replace these exact test addresses.");
  process.exit(0);
}

const [{ and, eq }, { hashPassword }, { db }, schema, { RSVP_DEADLINE }] = await Promise.all([
  import("drizzle-orm"),
  import("@better-auth/utils/password"),
  import("../lib/db"),
  import("../lib/db/schema"),
  import("../lib/config"),
]);
const { account, application, applicationEvent, applicationTag, tag, user } = schema;

const credentials: Array<{ email: string; password: string; state: string }> = [];

for (const fixture of fixtures) {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, fixture.email))
    .limit(1);

  if (existing && !RESET) {
    credentials.push({ email: fixture.email, password: "unchanged", state: "already existed" });
    continue;
  }
  if (existing && RESET) {
    await db.delete(user).where(and(eq(user.id, existing.id), eq(user.email, fixture.email)));
  }

  const password = randomBytes(18).toString("base64url");
  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  await db.insert(user).values({
    id: userId,
    email: fixture.email,
    name: fixture.name,
    emailVerified: true,
    role: "applicant",
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });

  const now = new Date();
  const [created] = await db
    .insert(application)
    .values({
      userId,
      answers: {
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        dateOfBirth: fixture.dateOfBirth,
        schoolName: "Stanford XR Test School",
        schoolCountry: "United States",
        schoolRegion: "California",
        gradYear: "2028",
        hackathonsBucket: "1-2",
        firstHackathon: false,
        priorAttendance: "0",
        primarySkill: "Engineering: Unity",
        skills: ["Unity", "C#"],
        tshirtSize: "M",
        sponsorShareOk: false,
        heardAboutUs: "Other",
        whyParticipate: "Test account for safely reviewing the released-decision experience.",
        ceoQuestion: "How can spatial computing become more accessible?",
      },
      firstName: fixture.firstName,
      lastName: fixture.lastName,
      dateOfBirth: fixture.dateOfBirth,
      schoolName: "Stanford XR Test School",
      schoolCountry: "United States",
      schoolRegion: "California",
      gradYear: 2028,
      hackathonsBucket: "1-2",
      firstHackathon: false,
      priorAttendance: "0",
      primarySkill: "Engineering: Unity",
      tshirtSize: "M",
      heardAboutUs: "Other",
      stage: "decided",
      decision: fixture.decision,
      decidedAt: now,
      submittedAt: now,
      rsvp: fixture.rsvp,
      rsvpDeadline: fixture.rsvp ? RSVP_DEADLINE : null,
    })
    .returning({ id: application.id });

  const [testTag] = await db
    .insert(tag)
    .values({ name: "test-account" })
    .onConflictDoUpdate({ target: tag.name, set: { archived: false } })
    .returning({ id: tag.id });
  await db.insert(applicationTag).values({ applicationId: created.id, tagId: testTag.id });
  await db.insert(applicationEvent).values([
    { applicationId: created.id, actorKind: "system", kind: "test_account_seeded" },
    { applicationId: created.id, actorKind: "system", kind: "decision_released", payload: { decision: fixture.decision, testAccount: true } },
  ]);
  credentials.push({ email: fixture.email, password, state: existing ? "reset" : "created" });
}

writeFileSync(OUTPUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), accounts: credentials }, null, 2)}\n`, {
  mode: 0o600,
});
chmodSync(OUTPUT, 0o600);
console.log(`Wrote credentials to ${OUTPUT} (mode 0600).`);
