# Immerse the Bay 2026 — Application Portal

Application portal for Stanford XR's Immerse the Bay hackathon, 13–15 November 2026.
Separate from the marketing site ([`StanfordXR/immerse-the-bay-2026`](https://github.com/StanfordXR/immerse-the-bay-2026)),
which stays public — this repo holds applicant PII.

**Applications open 14 August 2026.**

## Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack) | Above the CVE-2026-45109 fix line — don't downgrade below 16.2.6 |
| Auth | Better Auth 1.6.26 | Google + GitHub + email/password, one linked account |
| Database | Neon Postgres | Via Vercel Marketplace |
| ORM | Drizzle | No codegen step in the deploy pipeline |
| Uploads | Vercel Blob (client-direct) | Functions cap request bodies at 4.5 MB |
| Email | Resend | Free tier is 100/day — see below |
| Analytics | Own Postgres + PostHog | Only our DB can join attribution to acceptance |

## Setup

```bash
npm install
cp .env.example .env.local     # then fill it in — every var is documented there
npm run preflight              # fails loudly on anything missing or placeholder
npm run db:push                # push schema to Neon
npm run dev
```

## Scripts

| Script | Does |
|---|---|
| `npm run preflight` | Config check. Exits non-zero. Run before any deploy |
| `npm run db:generate` | Emit a migration from schema changes |
| `npm run db:migrate` / `db:push` | Apply migrations / push directly |
| `npm run db:studio` | Browse the database |
| `npm run auth:generate` | Regenerate `lib/db/auth-schema.ts` after changing auth config |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
proxy.ts                 First-touch UTM capture. NOT an auth boundary.
lib/auth.ts              Better Auth server config
lib/auth-client.ts       Browser client
lib/permissions.ts       applicant / reviewer / admin access control
lib/dal.ts               Data Access Layer — the ONLY place authz is decided
lib/attribution.ts       UTM normalization + cookie shape
lib/db/
  index.ts               Drizzle client (pooled connection)
  auth-schema.ts         GENERATED — do not hand-edit
  app-schema.ts          Our tables
  schema.ts              Re-exports both
scripts/preflight.mjs    Deploy gate
```

## Things that will bite you

**Authorization never goes in `proxy.ts`.** Next.js has shipped three
middleware auth-bypass CVEs in eighteen months, and Server Functions are POSTs to
the route they live in, so a matcher change can silently drop coverage. Every
page, route handler and Server Action calls `lib/dal.ts`. Proxy is for redirects
and analytics only.

**Two Neon connection strings, and they are not interchangeable.** Runtime uses
the *pooled* endpoint (`-pooler` in the hostname, ~10k clients). Migrations use
the *direct* one, because transaction-mode pooling breaks migration tooling. Get
this backwards and 30 concurrent reviewers exhaust the ~104-connection cap.
`npm run preflight` checks both.

**Google's OAuth consent screen must be published to "In production".** While it
sits in "Testing" you are hard-capped at 100 users and everyone sees an
unverified-app warning. It's a toggle, not a review — our scopes (`openid`,
`email`, `profile`) are non-sensitive. Verify by signing in with an account that
is *not* on the test-user list.

**GitHub allows one callback URL per OAuth app.** Make two apps — production and
local/preview — or you'll fight it constantly.

**Resend free tier is 100 emails/day** and requires a verified sending domain.
Fine for confirmations; nowhere near enough for a decision send. Upgrade to Pro
($20) for the decision month, then downgrade. Send every confirmation from the
sending domain starting on day one, so it has warm-up history before the
decision blast — a cold domain sending hundreds of near-identical messages gets
bulk-foldered.

**Never put file bytes in Postgres.** Neon's free tier caps at 0.5 GB and turns
the database read-only when hit. Resumes go to Blob; only URLs go in the DB.

**`lib/db/auth-schema.ts` is generated.** Hand edits are lost on the next
`npm run auth:generate`. Our tables live in `app-schema.ts`.

## Attribution

`proxy.ts` writes a first-touch cookie (`itb_attr`) before the CDN cache, so
marketing pages stay static. It's a *server-set* cookie rather than
localStorage: both survive the OAuth redirect, but Safari caps script-writable
storage at seven days, and the real journey is "scan a flyer at the activities
fair, apply twelve days later."

Values are normalized server-side (lowercased, punctuation stripped) because
`Instagram`, `instagram` and `INSTAGRAM ` otherwise become three rows in every
report.

Keep `utm_campaign=itb-2026` on **every** link — that's what separates this
event from next year's in the same table. Give each physical flyer location its
own `utm_content`, and test-scan every QR code with a real phone before the
print run.

The query this all exists to answer:

```sql
SELECT coalesce(utm_source, 'direct') AS source,
       count(*) AS applicants,
       count(*) FILTER (WHERE decision = 'accepted') AS accepted
FROM application
WHERE submitted_at IS NOT NULL
GROUP BY 1 ORDER BY applicants DESC;
```

No hosted analytics tool can produce that `accepted` column, because none of
them know the admissions outcome. That's why attribution is first-party.

## Context worth carrying

Last year's Typeform: **1,813 views → 956 starts → 436 submissions** (45.6%
completion, ~78 min average). It already had autosave, stepped pages,
essays-last and a mobile layout — so the obvious fixes are spent, and the
remaining lever is *total effort*. Every non-essay field should be a structured
input rather than free text. That also fixes data quality: last year "hackathons
attended" had a maximum of 10,000 and a median of 2, and "Stanford" vs "Stanford
University" made our own students uncountable.

Applicants under 18 on **13 November 2026** are filtered at acceptance. Compute
age against the event date, not the submission date.
