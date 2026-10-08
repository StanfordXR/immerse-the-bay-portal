import { redirect } from "next/navigation";
import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, linkClick } from "@/lib/db/schema";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  UTM_PARAMS,
  normalizeUtm,
  type Attribution,
} from "@/lib/attribution";

/**
 * Self-hosted short links for QR codes and campaign posts. Clicks land in our
 * own Postgres, joinable against submissions and acceptances.
 *
 * HAND OUT `immersethebay.org/r/<code>`, NEVER `portal.immersethebay.org/...`
 * and never a raw `?utm_source=…` URL. The marketing site forwards /r/* here,
 * so this table still resolves the code, but the printed link stays on the
 * marketing domain. A raw UTM URL on the marketing site sets NO itb_attr
 * cookie — that repo has no middleware — so it looks tracked in PostHog while
 * `application.utm_source` stays null. Only this hop writes first touch.
 * See CLAUDE.md.
 *
 * An unresolved code falls through to redirect("/") — the PORTAL home, with no
 * attribution. Deploy and curl a code BEFORE it is printed; a QR cannot be
 * fixed after the print run.
 *
 * Tagging scheme (deliberately condensed — short URLs beat taxonomy purity):
 *   utm_source  = where, in the shortest unambiguous token (ig, li, dc, flyer…)
 *   utm_content = placement within the source, when there's more than one
 *   no utm_campaign / utm_medium — one event, and the source implies the medium
 *
 * Personal referral codes: utm_source=ref, utm_content=<handle>. Add a row here
 * and in the Notion master list; performance is visible in PostHog and /admin.
 *
 * Master list of codes lives in Notion (owner: Victor). Add codes BEFORE
 * anything ships — printed QR codes are unfixable.
 *
 * Listserv and flyer codes are the exception to "add a row here": `l-<slug>`
 * and `f-<slug>` resolve by pattern (see PATTERN_SOURCES below), so dozens of
 * mailing lists or poster locations need no map entry and no deploy each.
 */
const LINKS: Record<string, string> = {
  // flyers — legacy hardcoded locations. New poster sites use the `f-<slug>`
  // pattern instead, which lands on the marketing site rather than /apply.
  f1: "/apply?utm_source=flyer&utm_content=huang",
  f2: "/apply?utm_source=flyer&utm_content=tress",
  f3: "/apply?utm_source=flyer&utm_content=dschool",
  f4: "/apply?utm_source=flyer&utm_content=fair",
  // socials
  ig: "/apply?utm_source=ig&utm_content=bio",
  li: "/apply?utm_source=li",
  dc: "/apply?utm_source=dc",
  // discord servers — one code per server (sxr = Stanford XR, itbNN = that
  // year's hackathon server). These land on the marketing site, not /apply:
  // cold-ish audiences should see what the event is before an application form.
  dcx: "https://immersethebay.org/?utm_source=dc&utm_content=sxr",
  dc25: "https://immersethebay.org/?utm_source=dc&utm_content=itb25",
  dc24: "https://immersethebay.org/?utm_source=dc&utm_content=itb24",
  dc23: "https://immersethebay.org/?utm_source=dc&utm_content=itb23",
  // a/b creative tests — same source, variant in utm_content
  li1: "/apply?utm_source=li&utm_content=a",
  li2: "/apply?utm_source=li&utm_content=b",
  // mailing lists — `ml` is the catch-all; per-listserv codes are `l-<slug>`,
  // resolved by pattern rather than listed here.
  ml: "/apply?utm_source=email",
  // partner clubs — one code per partner
  bx: "/apply?utm_source=berkeley-xr",
  // reality hack — partner hackathon's audience, so the marketing site first
  rh: "https://immersethebay.org/?utm_source=realityhack",
  // uc berkeley outreach — cold audience at another campus, so these land on
  // the marketing site (same rationale as the discord-server codes above).
  // Channel codes carry utm_content=ucb; the bare code is the catch-all for
  // flyers/QR/word-of-mouth and uses utm_source=ucb since it has no channel.
  ucb: "https://immersethebay.org/?utm_source=ucb",
  ucbe: "https://immersethebay.org/?utm_source=email&utm_content=ucb",
  ucbig: "https://immersethebay.org/?utm_source=ig&utm_content=ucb",
  ucbli: "https://immersethebay.org/?utm_source=li&utm_content=ucb",
  ucbdc: "https://immersethebay.org/?utm_source=dc&utm_content=ucb",
};

/**
 * One code per listserv, without a map entry per listserv: `/r/l-<slug>` where
 * the slug is the list's own name, carried through as utm_content — so
 * `l-cs-dept` reports as `email / cs-dept`.
 *
 * Underscores are accepted but canonicalized to hyphens, and repeated
 * separators collapse, so `l-cs_dept`, `l-cs--dept` and `l-cs-dept` are one
 * bucket rather than three. A mass send is assembled once and cannot be
 * corrected after the fact: forgiving input, single canonical output.
 */
const PATTERN_CODE = /^[a-z]-([a-z0-9][a-z0-9_-]{0,30})$/;

function patternSlug(code: string): string | null {
  const m = PATTERN_CODE.exec(code);
  if (!m) return null;
  const slug = m[1].replace(/_/g, "-").replace(/-+/g, "-").replace(/-$/, "");
  return slug || null;
}

/**
 * Prefixes resolved by pattern instead of by a map entry: `<prefix>-<slug>`
 * lands on the marketing site tagged with that source, and the slug carries
 * through as utm_content. `l-cs-dept` reports as `email / cs-dept`,
 * `f-treefest` as `flyer / treefest`.
 *
 * Flyers are the reason this matters most: one code per physical location, and
 * a print run is committed the moment it leaves the printer.
 */
const PATTERN_SOURCES: Record<string, string> = {
  l: "email", // listservs — one code per mailing list
  f: "flyer", // physical locations — one code per poster site
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.toLowerCase();
  let destination = LINKS[normalized];

  // Pattern-resolved campaigns: listservs (l-) and flyer locations (f-).
  // Both are cold audiences — someone else's mailing list, or a stranger at a
  // festival — so they see what the event is before an application form, same
  // as the Discord and UCB codes. Checked before the referral lookup to skip a
  // DB round trip.
  //
  // A malformed `l-…` code still lands on the marketing site rather than
  // falling through to the portal home: the recipient is a real lead either
  // way, and `utm_content=other` makes the bad link visible in the report
  // instead of silently costing us the click.
  const patternSource = PATTERN_SOURCES[normalized.slice(0, 1)];
  if (!destination && patternSource && normalized[1] === "-") {
    const slug = patternSlug(normalized);
    destination =
      `https://immersethebay.org/?utm_source=${patternSource}&utm_content=` +
      (slug ?? "other");
  }

  // Personal referral codes are minted per applicant at submit time.
  if (!destination && /^[a-z2-9]{6}$/.test(normalized)) {
    const [row] = await db
      .select({ code: application.referralCode })
      .from(application)
      .where(eq(application.referralCode, normalized))
      .limit(1);
    if (row) {
      // Referred friends land on the marketing site like every other
      // campaign; the external-redirect branch below stamps first touch so
      // the referral still counts when they eventually submit.
      destination = `https://immersethebay.org/?utm_source=ref&utm_content=${normalized}`;
    }
  }

  if (!destination) redirect("/");

  // External destinations (the marketing site) can't set the first-touch
  // cookie themselves — the marketing repo has no middleware — so the hop sets
  // it here from the destination's own UTM params. This is different from the
  // hop-must-not-set rule in proxy.ts: that rule guards against a *referrer*
  // captured on the hop beating the destination's UTMs; here the cookie IS the
  // destination's UTMs. First touch still wins: an existing cookie is kept.
  if (destination.startsWith("http")) {
    const dest = new URL(destination);
    const response = NextResponse.redirect(dest, 307);

    const hasCookie = (request.headers.get("cookie") ?? "").includes(
      `${ATTRIBUTION_COOKIE}=`,
    );
    if (!hasCookie) {
      const attribution: Attribution = {};
      for (const param of UTM_PARAMS) {
        const value = normalizeUtm(dest.searchParams.get(param));
        if (value) {
          attribution[param.replace("utm_", "") as keyof Attribution] =
            value as never;
        }
      }
      if (Object.keys(attribution).length > 0) {
        attribution.lp = dest.pathname.slice(0, 120);
        attribution.ts = Date.now();
        response.cookies.set({
          name: ATTRIBUTION_COOKIE,
          value: JSON.stringify(attribution),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: ATTRIBUTION_MAX_AGE,
          ...(process.env.COOKIE_DOMAIN
            ? { domain: process.env.COOKIE_DOMAIN }
            : {}),
        });
      }
    }

    after(async () => {
      try {
        await db.insert(linkClick).values({
          code: normalized,
          referrer: request.headers.get("referer"),
          userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        });
      } catch (err) {
        console.error("[r] click log failed:", err);
      }
    });

    return response;
  }

  after(async () => {
    try {
      await db.insert(linkClick).values({
        code: normalized,
        referrer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      });
    } catch (err) {
      console.error("[r] click log failed:", err);
    }
  });

  redirect(destination);
}
