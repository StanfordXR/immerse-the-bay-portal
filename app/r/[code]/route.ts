import { redirect } from "next/navigation";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, linkClick } from "@/lib/db/schema";

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
      destination = `/apply?utm_source=ref&utm_content=${normalized}`;
    }
  }

  if (!destination) redirect("/");

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
