import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ac, roles } from "@/lib/permissions";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example`);
  return value;
}

export const auth = betterAuth({
  appName: "Immerse the Bay",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: required("BETTER_AUTH_SECRET"),

  database: drizzleAdapter(db, { provider: "pg", schema }),

  // Email + password, so signing in never depends on an email being delivered.
  // Resend's free tier allows 100 emails/day; magic links would put that quota
  // directly on the login path and stall signups during a launch-day spike.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Verification is not required to submit. An applicant who mistypes their
    // address should still reach the end of the form; we chase the address later
    // rather than losing the application.
    requireEmailVerification: false,
  },

  socialProviders: {
    google: {
      clientId: required("GOOGLE_CLIENT_ID"),
      clientSecret: required("GOOGLE_CLIENT_SECRET"),
    },
    github: {
      clientId: required("GITHUB_CLIENT_ID"),
      clientSecret: required("GITHUB_CLIENT_SECRET"),
    },
  },

  account: {
    accountLinking: {
      // Someone who signs up with email/password and later clicks "Sign in with
      // Google" on the same verified address gets one account, not two.
      enabled: true,
      // Deliberately NOT setting `trustedProviders`: that would link accounts
      // without a verified email and opens a genuine account-takeover path.
    },
  },

  // On Vercel every invocation may be a fresh instance, so in-memory rate-limit
  // counters reset constantly. Database storage makes the limits real.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-up/email": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // No cookieCache. Better Auth uses database sessions, so revoking a
    // compromised reviewer or admin takes effect on their next request. Enabling
    // the cookie cache would turn "revoke now" into "revoke in a few minutes" —
    // a bad trade when these accounts can read every applicant's PII.
  },

  plugins: [
    adminPlugin({
      ac,
      roles,
      defaultRole: "applicant",
      adminRoles: ["admin"],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
