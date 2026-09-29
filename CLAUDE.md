# Notes for whoever works on this next (human or AI)

## Campaign links: always `immersethebay.org/r/<code>`

**Every** campaign link — QR codes, flyers, posters, emails, social bios — points at

```
https://immersethebay.org/r/<code>
```

the marketing domain, with an `/r/` code. Not the portal host. Not a raw
`?utm_source=…` URL. The marketing site forwards `/r/*` to
`portal.immersethebay.org/r/*`, so the code table in `app/r/[code]/route.ts` is
still what resolves it — the visitor just never sees the portal hostname.

### Why a raw UTM URL is wrong, even though it looks fine

The marketing repo has no middleware, so a direct hit on
`immersethebay.org/?utm_source=flyer&utm_content=treefest` sets **no**
`itb_attr` cookie. Verified 2026-09-28:

| URL | `itb_attr` set? |
|---|---|
| `immersethebay.org/?utm_source=flyer&utm_content=treefest` | **no** |
| `immersethebay.org/r/l-cs-dept` | yes |

Only the `/r/` hop writes first-touch attribution. A raw UTM URL still shows up
in PostHog's `$pageview`, so it *looks* tracked — but `application.utm_source`
stays null, and the "which source actually produced accepted applicants" query
in `README.md` silently loses that whole channel. That query is the reason this
system exists.

### Why not the portal host

1. It leaks an internal hostname onto printed material.
2. A cold audience (festival, another campus, someone else's mailing list) hits
   a sign-in wall instead of learning what the event is. Land them on the
   marketing site and let them choose to apply.
3. It is longer, so the QR is denser: `portal.immersethebay.org/apply?utm_source=flyer&utm_content=treefest`
   is 76 chars (QR version 5, 37 modules) against 45 chars for a short link
   (version 4, 33 modules). On a poster read at distance that matters.

### An unknown code fails silently — and badly

`app/r/[code]/route.ts` sends an unresolved code to `redirect("/")`, which is
the **portal** home. So a printed QR with a code that was never deployed:

- dumps the scanner on the wrong site,
- records no attribution at all,
- and cannot be fixed, because it is already printed.

Verified: `immersethebay.org/r/f-treefest` (never deployed) currently ends at
`https://portal.immersethebay.org/` with no cookie.

**So: add and deploy the code, curl it, and test-scan the real printed proof
before any print run.** Listserv codes (`l-<slug>`) resolve by pattern and need
no deploy; flyer codes do not have a pattern yet and are hardcoded.

## Attribution generally

`README.md` has the full picture. The short version: first touch wins, it is
stored server-side in the `itb_attr` cookie on `.immersethebay.org`, and it is
first-party precisely because no hosted analytics tool knows the admissions
outcome.
