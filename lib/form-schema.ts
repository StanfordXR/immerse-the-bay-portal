import { z } from "zod";

/**
 * Single source of truth for the application form: option lists, validation,
 * step layout, and the answers→columns promotion.
 *
 * Design intent, learned from last year's data: the 2025 Typeform lost 54% of
 * everyone who started it *despite* autosave, stepped pages and essays-last —
 * so the remaining lever is total effort. Every non-essay field here is a
 * structured input, which also fixes the data: free text gave us a "hackathons
 * attended" with a max of 10,000, and "Stanford" vs "Stanford University" made
 * our own students uncountable.
 */

// ── option lists ─────────────────────────────────────────────────────────────

export const PRONOUN_OPTIONS = [
  "she/her",
  "he/him",
  "they/them",
  "self-describe",
  "prefer not to say",
] as const;

export const HACKATHON_BUCKETS = ["0", "1-2", "3-5", "6+"] as const;

export const HACKATHON_BUCKET_LABELS: Record<string, string> = {
  "0": "This is my first",
  "1-2": "1–2",
  "3-5": "3–5",
  "6+": "6+",
};

// Repeat-attendee metric only, never an admissions signal.
export const PRIOR_ATTENDANCE = ["0", "1", "2", "3"] as const;

export const GRAD_YEARS = [
  "2026",
  "2027",
  "2028",
  "2029",
  "2030",
  "2031",
  "2032",
  "Earlier",
  "Not a student",
] as const;

export const PRIMARY_SKILLS = [
  "Engineering — Unity",
  "Engineering — Unreal",
  "Engineering — Web / WebXR",
  "Engineering — AI / ML",
  "3D / Technical Art",
  "Design — UI / UX / Spatial",
  "Audio",
  "Hardware",
  "Product / PM",
  "Other",
] as const;

export const SKILL_CHIPS = [
  "Unity",
  "Unreal",
  "WebXR / three.js",
  "visionOS / Swift",
  "C#",
  "C++",
  "Python",
  "JS / TS",
  "3D modeling",
  "Blender",
  "Technical art",
  "Shaders / graphics",
  "UI/UX design",
  "Spatial design",
  "Animation",
  "Audio",
  "Music / sound design",
  "Hardware",
  "Electronics",
  "AI / ML",
  "Computer vision",
  "Backend",
  "Networking / multiplayer",
  "Game design",
  "Product",
  "Storytelling",
  "Video / media",
] as const;

export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const HEARD_OPTIONS = [
  "Instagram",
  "LinkedIn",
  "Discord",
  "Flyer / poster QR code",
  "Friend or classmate",
  "Class or professor",
  "Partner club at my school",
  "Mailing list",
  "Devpost",
  "Other",
] as const;

export const COUNTRIES = [
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Netherlands",
  "Spain",
  "Portugal",
  "Italy",
  "Switzerland",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czechia",
  "Austria",
  "Greece",
  "Türkiye",
  "Ukraine",
  "India",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "China",
  "Hong Kong",
  "Taiwan",
  "Japan",
  "South Korea",
  "Singapore",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Thailand",
  "Vietnam",
  "Australia",
  "New Zealand",
  "Israel",
  "United Arab Emirates",
  "Saudi Arabia",
  "Egypt",
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "Morocco",
  "Argentina",
  "Chile",
  "Colombia",
  "Peru",
  "Other",
] as const;

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

/** Typeahead suggestions — free text is still allowed. Sourced from last year's applicant pool. */
export const UNIVERSITY_SUGGESTIONS = [
  "Stanford University",
  "University of California, Berkeley",
  "San José State University",
  "San Francisco State University",
  "Santa Clara University",
  "University of California, Davis",
  "University of California, Santa Cruz",
  "University of California, Los Angeles",
  "University of California, San Diego",
  "University of California, Irvine",
  "University of Southern California",
  "California Polytechnic State University, San Luis Obispo",
  "Cal Poly Pomona",
  "California State University, East Bay",
  "California State University, Sacramento",
  "De Anza College",
  "Foothill College",
  "Massachusetts Institute of Technology",
  "Carnegie Mellon University",
  "Georgia Institute of Technology",
  "University of Texas at Austin",
  "University of Texas at Arlington",
  "University of Washington",
  "University of Illinois Urbana-Champaign",
  "Purdue University",
  "University of Michigan",
  "Cornell University",
  "Columbia University",
  "New York University",
  "University of Waterloo",
  "University of Toronto",
  "University of British Columbia",
  "Kennesaw State University",
] as const;

// ── validation ───────────────────────────────────────────────────────────────

// Word-based limits: "300 words" reads achievable where "2000 characters"
// reads like homework, and words are the unit applicants think in.
export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const WHY_MIN_WORDS = 20;
const WHY_MAX_WORDS = 200;
const CEO_MIN_WORDS = 3;
const CEO_MAX_WORDS = 50;

export const ESSAY_LIMITS = {
  whyParticipate: { min: WHY_MIN_WORDS, max: WHY_MAX_WORDS },
  ceoQuestion: { min: CEO_MIN_WORDS, max: CEO_MAX_WORDS },
} as const;

function isPlausibleDob(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  // Plausibility only — eligibility is checked at acceptance, not here.
  return year >= 1900 && d.getTime() <= Date.now();
}

const looksLikeLink = (v: string) => v === "" || v.includes(".");

const baseSchema = z.object({
  // stage 1 — identity
  firstName: z.string().trim().min(1, "Required").max(100),
  lastName: z.string().trim().min(1, "Required").max(100),
  pronouns: z.string().trim().max(60).optional().default(""),
  pronounsSelf: z.string().trim().max(60).optional().default(""),
  dateOfBirth: z
    .string()
    .refine(isPlausibleDob, "Enter a valid date of birth"),

  // stage 2 — background
  schoolName: z.string().trim().min(2, "Required").max(200),
  schoolCountry: z.string().trim().min(2, "Required").max(80),
  schoolRegion: z.string().trim().max(80).optional().default(""),
  gradYear: z.enum(GRAD_YEARS, { message: "Required" }),
  hackathonsBucket: z.enum(HACKATHON_BUCKETS, { message: "Required" }),
  priorAttendance: z.enum(PRIOR_ATTENDANCE, { message: "Required" }),
  primarySkill: z.enum(PRIMARY_SKILLS, { message: "Required" }),
  skills: z.array(z.string().max(40)).max(32).optional().default([]),
  skillsOther: z.string().trim().max(300).optional().default(""),
  portfolioUrl: z
    .string()
    .trim()
    .max(600)
    .refine(looksLikeLink, "That doesn't look like a link")
    .optional()
    .default(""),

  // stage 3 — story
  whyParticipate: z
    .string()
    .trim()
    .max(3000)
    .refine((v) => wordCount(v) >= WHY_MIN_WORDS, `Tell us a bit more, at least ${WHY_MIN_WORDS} words`)
    .refine((v) => wordCount(v) <= WHY_MAX_WORDS, `Keep it under ${WHY_MAX_WORDS} words`),
  ceoQuestion: z
    .string()
    .trim()
    .max(800)
    .refine((v) => wordCount(v) >= CEO_MIN_WORDS, "Give us a real question")
    .refine((v) => wordCount(v) <= CEO_MAX_WORDS, `Keep it under ${CEO_MAX_WORDS} words`),

  // stage 4 — logistics
  tshirtSize: z.enum(TSHIRT_SIZES, { message: "Required" }),
  dietaryNeeds: z.string().trim().max(300).optional().default(""),
  accessibilityNeeds: z.string().trim().max(500).optional().default(""),
  resumeUrl: z.string().trim().max(500).optional().default(""),
  heardAboutUs: z.enum(HEARD_OPTIONS, { message: "Required" }),
  heardAboutUsName: z.string().trim().max(100).optional().default(""),
  sponsorShareOk: z.boolean().optional().default(false),
});

export const submitSchema = baseSchema.superRefine((data, ctx) => {
  if (data.schoolCountry === "United States" && !data.schoolRegion) {
    ctx.addIssue({
      code: "custom",
      path: ["schoolRegion"],
      message: "Required",
    });
  }
  if (data.pronouns === "self-describe" && !data.pronounsSelf) {
    ctx.addIssue({
      code: "custom",
      path: ["pronounsSelf"],
      message: "Tell us your pronouns, or pick “prefer not to say”",
    });
  }
});

/**
 * Drafts accept anything partially filled. Fields with minimums, word counts,
 * or shape refines relax to bare char caps here: a half-typed essay or URL
 * must autosave cleanly, not flip the badge to an error. submitSchema still
 * enforces everything at submission.
 */
export const draftSchema = baseSchema.partial().extend({
  schoolName: z.string().trim().max(200).optional(),
  portfolioUrl: z.string().trim().max(600).optional(),
  whyParticipate: z.string().trim().max(3000).optional(),
  ceoQuestion: z.string().trim().max(800).optional(),
  dateOfBirth: z.string().max(10).optional(),
});

export type Answers = z.infer<typeof draftSchema>;

// ── stages (the metamorphosis) ───────────────────────────────────────────────

export const STEPS = [
  {
    id: "identity",
    title: "Identity",
    fields: ["firstName", "lastName", "pronouns", "pronounsSelf", "dateOfBirth"],
  },
  {
    id: "background",
    title: "Background",
    fields: [
      "schoolName",
      "schoolCountry",
      "schoolRegion",
      "gradYear",
      "hackathonsBucket",
      "priorAttendance",
      "primarySkill",
      "skills",
      "skillsOther",
      "portfolioUrl",
    ],
  },
  {
    id: "story",
    title: "Your Story",
    fields: ["whyParticipate", "ceoQuestion"],
  },
  {
    id: "logistics",
    title: "Logistics",
    fields: [
      "tshirtSize",
      "dietaryNeeds",
      "accessibilityNeeds",
      "resumeUrl",
      "heardAboutUs",
      "heardAboutUsName",
      "sponsorShareOk",
    ],
  },
  {
    id: "review",
    title: "Review & Submit",
    fields: [],
  },
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

/**
 * An unanswered required field fails Zod's *type* check, whose default message
 * ("Invalid input: expected string, received undefined") is developer-speak.
 * Applicants just need "Required".
 */
export function humanizeMessage(message: string): string {
  return /^Invalid (input|option|value)/.test(message) ? "Required" : message;
}

/**
 * Validate the full answers object, then keep only the issues belonging to one
 * step — so per-step "Next" validation and final submit can never disagree.
 */
export function stepIssues(
  answers: unknown,
  step: StepIndex,
): Record<string, string> {
  const result = submitSchema.safeParse(answers);
  if (result.success) return {};
  const fields = new Set<string>(STEPS[step].fields);
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (fields.has(key) && !out[key]) out[key] = humanizeMessage(issue.message);
  }
  return out;
}

/** Which form stages are complete — used by the dashboard progress view. */
export function stepStatus(answers: unknown): boolean[] {
  return [0, 1, 2, 3].map(
    (i) => Object.keys(stepIssues(answers, i as StepIndex)).length === 0,
  );
}

// ── answers → promoted DB columns ────────────────────────────────────────────

export function answersToColumns(a: Answers) {
  const gradYearNum =
    a.gradYear && /^\d{4}$/.test(a.gradYear) ? Number(a.gradYear) : null;
  return {
    firstName: a.firstName ?? null,
    lastName: a.lastName ?? null,
    // Drafts may carry a partial date; only a complete value reaches the
    // date-typed column.
    dateOfBirth:
      a.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(a.dateOfBirth)
        ? a.dateOfBirth
        : null,
    schoolName: a.schoolName ?? null,
    schoolCountry: a.schoolCountry ?? null,
    schoolRegion: a.schoolRegion || null,
    gradYear: gradYearNum,
    hackathonsBucket: a.hackathonsBucket ?? null,
    firstHackathon: a.hackathonsBucket ? a.hackathonsBucket === "0" : null,
    priorAttendance: a.priorAttendance ?? null,
    primarySkill: a.primarySkill ?? null,
    portfolioUrl: a.portfolioUrl || null,
    tshirtSize: a.tshirtSize ?? null,
    dietaryNeeds: a.dietaryNeeds || null,
    accessibilityNeeds: a.accessibilityNeeds || null,
    resumeUrl: a.resumeUrl || null,
    sponsorShareOk: a.sponsorShareOk ?? false,
    heardAboutUs: a.heardAboutUs ?? null,
    heardAboutUsName: a.heardAboutUsName || null,
  };
}
