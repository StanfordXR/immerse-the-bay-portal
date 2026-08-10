import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
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

/**
 * A social provider is included only when its credential pair exists, so a
 * missing provider degrades to "button errors when clicked" instead of
 * "the whole build fails". `next build` evaluates this module while collecting
 * page data — a throw here takes down every route.
 */
function socialProvider(idVar: string, secretVar: string) {
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) {
    console.warn(`[auth] ${idVar}/${secretVar} unset — provider disabled`);
    return null;
  }
  return { clientId, clientSecret };
}

const google = socialProvider("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
const github = socialProvider("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");

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
    ...(google ? { google } : {}),
    ...(github ? { github } : {}),
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

  hooks: {
    // Set the "last used method" hint ONLY after a session was actually
    // created — never on a mere attempt. Server-set, so it also survives
    // Safari's 7-day cap on JS-written cookies. Read by the sign-in card
    // (badge) and the proxy (returning-user detection); pure UX hint.
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.context.newSession) return;
      let method: string | null = null;
      if (ctx.path.startsWith("/callback/")) {
        method = ctx.path.split("/")[2] ?? null; // "google" | "github"
      } else if (
        ctx.path === "/sign-in/email" ||
        ctx.path === "/sign-up/email"
      ) {
        method = "email";
      }
      if (method === "google" || method === "github" || method === "email") {
        ctx.setCookie("itb_auth_hint", method, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
          httpOnly: false, // the badge reads it client-side
          secure: process.env.NODE_ENV === "production",
        });
      }
    }),
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
