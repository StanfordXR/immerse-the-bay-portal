/**
 * Generates the UTM link spreadsheet for marketing.
 *   node scripts/utm-links.mjs [base-url] > itb-utm-links.csv
 *
 * Rules that make the data analyzable later:
 *   - utm_campaign is `itb-2026` on EVERY link — that's what separates this
 *     event from next year's in the same table.
 *   - lowercase, hyphenated, no spaces (the server normalizes as a backstop).
 *   - one short code per PHYSICAL flyer location, so we learn which spots work.
 *   - partner clubs go in utm_source with utm_medium=partner, so "which partner
 *     performed best" is a one-line GROUP BY.
 */
const BASE = process.argv[2] ?? "https://apply.immersethebay.org";

const rows = [
  // [channel, placement, short link code, source, medium, content, notes]
  ["Flyer / QR", "Huang lobby", "f1", "flyer", "qr", "huang-lobby", "TEST-SCAN WITH A REAL PHONE BEFORE PRINTING"],
  ["Flyer / QR", "Tresidder board", "f2", "flyer", "qr", "tresidder-board", "TEST-SCAN WITH A REAL PHONE BEFORE PRINTING"],
  ["Flyer / QR", "d.school", "f3", "flyer", "qr", "dschool", "TEST-SCAN WITH A REAL PHONE BEFORE PRINTING"],
  ["Flyer / QR", "Activities fair", "f4", "flyer", "qr", "activities-fair", "TEST-SCAN WITH A REAL PHONE BEFORE PRINTING"],
  ["Instagram", "Bio link", "ig", "instagram", "social", "bio-link", "Use the short link in bio; stories can use it too"],
  ["LinkedIn", "Posts", "li", "linkedin", "social", "", ""],
  ["Discord", "Announcements", "dc", "discord", "social", "", ""],
  ["Partner club", "Berkeley XR", "bx", "berkeley-xr", "partner", "", "One code per partner — ask before adding new ones"],
  ["Mailing list", "Any listserv", "ml", "mailing-list", "email", "", ""],
];

console.log(
  "channel,placement,SHORT LINK (use this),full url (what it becomes),notes",
);
for (const [channel, placement, code, source, medium, content, notes] of rows) {
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: "itb-2026",
  });
  if (content) params.set("utm_content", content);
  const full = `${BASE}/apply?${params}`;
  const short = `${BASE}/r/${code}`;
  console.log(
    [channel, placement, short, full, notes]
      .map((v) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v))
      .join(","),
  );
}
console.error("New channel? Add a row HERE and a code in app/r/[code]/route.ts — don't hand-build URLs.");
