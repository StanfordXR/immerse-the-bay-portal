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
 */
const LINKS: Record<string, string> = {
  // flyers — one code per physical location
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
  // mailing lists
  ml: "/apply?utm_source=email",
  // partner clubs — one code per partner
  bx: "/apply?utm_source=berkeley-xr",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.toLowerCase();
  let destination = LINKS[normalized];

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
