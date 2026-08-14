import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  UTM_PARAMS,
  normalizeUtm,
  type Attribution,
} from "@/lib/attribution";

/** Signed-out visitors get bounced to /sign-in from these. UX only — see below. */
const PROTECTED_PREFIXES = ["/apply", "/dashboard", "/admin", "/feedback", "/review"];

/**
 * First-touch attribution capture.
 *
 * This is `proxy.ts`, not `middleware.ts` — Next.js 16 renamed the file and it
 * now defaults to the Node.js runtime. Most search results still show the old
 * name; `npx @next/codemod@canary middleware-to-proxy .` converts between them.
 *
 * Why capture here rather than in a page:
 *
 *   Marketing pages are statically prerendered and served from the CDN, so a
 *   Server Component never runs and never sees `?utm_source=`. Reading
 *   `searchParams` would make every page dynamic for every visitor just to catch
 *   a parameter most don't have, and `useSearchParams` forces client rendering
 *   up to the nearest Suspense boundary — with a build failure that doesn't
 *   reproduce locally, because dev renders on demand. Proxy runs *before* the
 *   cache on every request, so the page underneath stays fully static.
 *
 * Why a server-set cookie rather than localStorage:
 *
 *   Both survive the OAuth redirect to Google — that isn't the deciding factor.
 *   Safari is. WebKit caps *script-writable* storage (localStorage, and cookies
 *   written via document.cookie) at seven days, and the real journey here is
 *   "scan a flyer at the activities fair, apply twelve days later". On iOS that
 *   attribution is simply gone. A cookie set server-side in a Set-Cookie header
 *   is exempt. It's also readable directly in the Server Action that writes the
 *   application row, and it spans the marketing site and this subdomain.
 *
 * IMPORTANT: this is UX/analytics only. It performs no authorization. Access
 * control lives in lib/dal.ts and is called from every page, route handler and
 * Server Action — there have been three middleware auth-bypass CVEs in Next.js
 * in eighteen months, so proxy is not a security boundary.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optimistic sign-in redirect. This checks only that a session cookie
  // *exists* — it does not validate it, and it is not the security boundary.
  // Every protected page and action re-checks through lib/dal.ts.
  let response = NextResponse.next();
  const needsSession = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (needsSession && !getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname);
    // Carry UTM params onto the redirect: the itb_attr cookie already has
    // them (set below), but PostHog's SDK only sees the URL the browser
    // renders — without this, every signed-out Apply click loses its
    // utm_source in analytics.
    for (const [key, value] of request.nextUrl.searchParams) {
      if (key.startsWith("utm_")) signIn.searchParams.set(key, value);
    }
    // "Begin your application" implies a first-timer — open account creation.
    // Unless this browser has signed in before (auth-hint cookie), in which
    // case default to sign-in: returning users far outnumber people who lost
    // their session mid-application.
    if (
      pathname.startsWith("/apply") &&
      !request.cookies.has("itb_auth_hint")
    ) {
      signIn.searchParams.set("mode", "signup");
    }
    response = NextResponse.redirect(signIn);
  }

  // First touch wins. Someone who clicks a Discord reminder on day twelve is
  // still credited to the flyer that originally found them.
  if (request.cookies.has(ATTRIBUTION_COOKIE)) return response;

  const params = request.nextUrl.searchParams;
  const attribution: Attribution = {};

  for (const param of UTM_PARAMS) {
    const value = normalizeUtm(params.get(param));
    if (value) {
      attribution[param.replace("utm_", "") as keyof Attribution] =
        value as never;
    }
  }

  const referrer = request.headers.get("referer");
  const isExternal =
    referrer !== null && !referrer.includes(request.nextUrl.host);
  if (isExternal) attribution.ref = referrer.slice(0, 300);

  // Nothing worth recording — leave the cookie unset so a later visit that does
  // carry a UTM can still claim first touch.
  if (Object.keys(attribution).length === 0) return response;

  attribution.lp = request.nextUrl.pathname.slice(0, 120);
  attribution.ts = Date.now();

  response.cookies.set({
    name: ATTRIBUTION_COOKIE,
    value: JSON.stringify(attribution),
    httpOnly: true, // server-only, and exempt from Safari's 7-day cap
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on the OAuth GET callback
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE,
    // Set COOKIE_DOMAIN to `.immersethebay.org` in production so first touch on
    // the marketing site carries over to this subdomain. Left unset locally.
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });

  return response;
}

export const config = {
  // `r/` is excluded: short-link hops (/r/f1 → /apply?utm_…) must not set the
  // first-touch cookie themselves, or a referrer captured on the hop would win
  // over the UTM parameters carried by the destination URL.
  matcher: [
    "/((?!api|r/|_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml).*)",
  ],
};
