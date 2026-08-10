import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { linkClick } from "@/lib/db/schema";

/**
 * Self-hosted short links for QR codes and campaign posts.
 *
 * Built rather than bought: Dub's free tier is ~1,000 tracked events (one busy
 * afternoon at an activities fair) and Bitly's free plan interposes an ad page —
 * not something to put between a flyer scan and an application form. Clicks land
 * in our own Postgres, joinable against submissions and acceptances.
 *
 * Conventions: `utm_campaign=itb-2026` on every link. One code per *physical
 * location* for flyers — that's how you learn Huang lobby beats Tresidder 6:1.
 * Test-scan every code with a real phone before the print run.
 */
const LINKS: Record<string, string> = {
  // flyers — one code per location
  f1: "/apply?utm_source=flyer&utm_medium=qr&utm_campaign=itb-2026&utm_content=huang-lobby",
  f2: "/apply?utm_source=flyer&utm_medium=qr&utm_campaign=itb-2026&utm_content=tresidder-board",
  f3: "/apply?utm_source=flyer&utm_medium=qr&utm_campaign=itb-2026&utm_content=dschool",
  f4: "/apply?utm_source=flyer&utm_medium=qr&utm_campaign=itb-2026&utm_content=activities-fair",
  // social
  ig: "/apply?utm_source=instagram&utm_medium=social&utm_campaign=itb-2026&utm_content=bio-link",
  li: "/apply?utm_source=linkedin&utm_medium=social&utm_campaign=itb-2026",
  dc: "/apply?utm_source=discord&utm_medium=social&utm_campaign=itb-2026",
  // partners — one code per partner club
  bx: "/apply?utm_source=berkeley-xr&utm_medium=partner&utm_campaign=itb-2026",
  // mailing lists
  ml: "/apply?utm_source=mailing-list&utm_medium=email&utm_campaign=itb-2026",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const destination = LINKS[code.toLowerCase()];

  if (!destination) redirect("/");

  after(async () => {
    try {
      await db.insert(linkClick).values({
        code: code.toLowerCase(),
        referrer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      });
    } catch (err) {
      console.error("[r] click log failed:", err);
    }
  });

  redirect(destination);
}
