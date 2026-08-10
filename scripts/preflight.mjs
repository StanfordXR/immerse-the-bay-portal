/**
 * Deploy preflight. Run before pointing the domain at a build:
 *
 *   npm run preflight
 *
 * Checks the configuration mistakes that fail silently or fail late — the ones
 * you'd otherwise discover from a spike in 500s on launch morning. Exits
 * non-zero so it can gate a deploy.
 */

const errors = [];
const warnings = [];

function requireEnv(name, hint) {
  if (!process.env[name]) errors.push(`${name} is not set — ${hint}`);
}

// ── secrets and providers ───────────────────────────────────────────────────
requireEnv("DATABASE_URL", "provision Neon with `vercel install neon`");
requireEnv("BETTER_AUTH_SECRET", "generate with `openssl rand -base64 32`");
requireEnv("GOOGLE_CLIENT_ID", "Google Cloud Console → Credentials");
requireEnv("GOOGLE_CLIENT_SECRET", "Google Cloud Console → Credentials");
requireEnv("GITHUB_CLIENT_ID", "GitHub → Developer settings → OAuth Apps");
requireEnv("GITHUB_CLIENT_SECRET", "GitHub → Developer settings → OAuth Apps");

// ── the pooled-connection trap ──────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && !dbUrl.includes("-pooler")) {
  errors.push(
    "DATABASE_URL is not Neon's pooled endpoint (hostname should contain `-pooler`). " +
      "The direct endpoint caps near 104 connections; Vercel opens one per invocation, " +
      "so concurrent reviewers will exhaust it. Use the direct string only in drizzle.config.ts.",
  );
}
if (
  process.env.DATABASE_URL_DIRECT &&
  process.env.DATABASE_URL_DIRECT.includes("-pooler")
) {
  errors.push(
    "DATABASE_URL_DIRECT points at the pooled endpoint. Migrations need the direct one — " +
      "transaction-mode pooling breaks migration tooling.",
  );
}

// ── placeholders that made it to a real environment ─────────────────────────
for (const [name, value] of Object.entries(process.env)) {
  if (!value) continue;
  if (/placeholder|replace-me|changeme|xxx/i.test(value) && /SECRET|KEY|CLIENT|DATABASE/i.test(name)) {
    errors.push(`${name} still contains a placeholder value.`);
  }
}

// ── things that are fine locally but wrong in production ────────────────────
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.BETTER_AUTH_URL?.startsWith("https://")) {
    errors.push("BETTER_AUTH_URL must be an https:// origin in production.");
  }
  if (!process.env.COOKIE_DOMAIN) {
    warnings.push(
      "COOKIE_DOMAIN is unset. First-touch attribution captured on the marketing " +
        "site won't carry to this subdomain — set it to `.immersethebay.org`.",
    );
  }
  if (!process.env.RESEND_API_KEY) {
    warnings.push("RESEND_API_KEY is unset — confirmation emails will not send.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    warnings.push("BLOB_READ_WRITE_TOKEN is unset — resume upload will fail.");
  }
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    warnings.push(
      "NEXT_PUBLIC_POSTHOG_KEY is unset. The funnel is how you find the step that " +
        "loses applicants — last year's form lost 54% of everyone who started it.",
    );
  }
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
for (const e of errors) console.error(`❌ ${e}`);

if (errors.length > 0) {
  console.error(`\npreflight failed: ${errors.length} error(s)\n`);
  process.exit(1);
}

console.log(
  `✅ preflight passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}\n`,
);
