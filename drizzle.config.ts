import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Migrations run against Neon's DIRECT endpoint, not the pooled one.
// PgBouncer's transaction pooling mode breaks migration tooling (prepared
// statements and session-level state don't survive it). Runtime queries do the
// opposite — see lib/db/index.ts.
// DATABASE_URL_UNPOOLED is the name the Vercel Neon integration injects.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL_DIRECT ??
  process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL_DIRECT (or DATABASE_URL) must be set");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
