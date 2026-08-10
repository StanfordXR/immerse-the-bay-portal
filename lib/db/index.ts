import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Neon hands out two connection strings and using the wrong one at runtime is a
 * silent scaling bug rather than an obvious error:
 *
 *   pooled  — hostname contains `-pooler`. PgBouncer, ~10k clients. Use at runtime;
 *             Vercel opens a connection per function invocation.
 *   direct  — no `-pooler`, caps near 104 connections. Migrations only, because
 *             transaction-mode pooling breaks migration tooling.
 *
 * A mismatch is warned about here and enforced by `npm run preflight`, which
 * exits non-zero. Deliberately not a throw at module scope: `next build`
 * evaluates this file with NODE_ENV=production, so throwing would break builds
 * whenever local env holds placeholder credentials — and could take production
 * down over a hostname-format change rather than a real fault.
 */
export function checkConnectionString(url: string | undefined): string | null {
  if (!url) {
    return "DATABASE_URL is not set. Provision Neon with `vercel install neon`, then `vercel env pull .env.local`.";
  }
  if (process.env.NODE_ENV === "production" && !url.includes("-pooler")) {
    return "DATABASE_URL is not using Neon's pooled endpoint (hostname should contain `-pooler`). The direct endpoint caps near 104 connections and will exhaust under load.";
  }
  return null;
}

const connectionString = process.env.DATABASE_URL;
const problem = checkConnectionString(connectionString);

if (problem) console.error(`[db] ${problem}`);

// Constructing a Neon Pool does not open a connection — the first query does.
// So this is safe to evaluate at build time even with placeholder credentials.
const pool = new Pool({
  connectionString: connectionString ?? "postgresql://unconfigured",
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
