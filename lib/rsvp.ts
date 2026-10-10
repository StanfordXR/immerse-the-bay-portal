import { z } from "zod";
import { TSHIRT_SIZES } from "@/lib/form-schema";

/**
 * The confirmation form an accepted hacker fills in to claim their spot
 * (/rsvp). Pure data and schemas, shared by the client form and the
 * `confirmSpot` server action.
 */

export const DIETARY_OPTIONS = [
  "None",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
] as const;

/** Required agreements, each stored with the time it was accepted. */
export const AGREEMENTS = [
  {
    key: "codeOfConduct",
    label: "I have read and agree to the Immerse the Bay Code of Conduct.",
    href: "/code-of-conduct",
  },
  {
    key: "photoConsent",
    label:
      "I consent to being photographed or recorded during Immerse the Bay, including by external media outlets. I understand these materials may be used by organizers, sponsors, or media for promotional or journalistic purposes.",
  },
  {
    key: "liability",
    label:
      "I acknowledge that I am responsible for my personal belongings and safety. I agree to release Immerse the Bay organizers, sponsors, and the venue from any liability for lost, stolen, or damaged property, or for personal injury.",
  },
] as const;

export type AgreementKey = (typeof AGREEMENTS)[number]["key"];

const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === "" || (v.replace(/\D/g, "").length >= 7), "Enter a valid phone number");

export const rsvpFormSchema = z.object({
  badgeName: z.string().trim().min(1, "Required").max(120),
  tshirtSize: z.enum(TSHIRT_SIZES, { message: "Pick a shirt size" }),
  dietary: z.string().trim().min(1, "Pick an option").max(300),
  pronouns: z.string().trim().max(60),
  phone,
  emergencyName: z.string().trim().min(1, "Required").max(120),
  emergencyEmail: z.email("Enter a valid email").max(200),
  emergencyPhone: phone.refine((v) => v !== "", "Required"),
  agreements: z.object({
    codeOfConduct: z.literal(true, "Required"),
    photoConsent: z.literal(true, "Required"),
    liability: z.literal(true, "Required"),
  } satisfies Record<AgreementKey, z.ZodType>),
});

export type RsvpForm = z.infer<typeof rsvpFormSchema>;

/** What lands in `application.rsvp_details`. Shirt size and dietary go to their own columns. */
export type RsvpDetails = {
  /** Optional for records confirmed before badge names were collected. */
  badgeName?: string;
  pronouns: string | null;
  phone: string | null;
  emergencyContact: { name: string; email: string; phone: string };
  /** ISO timestamp of when each agreement was first accepted. */
  agreedAt: Record<AgreementKey, string>;
};
