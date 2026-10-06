const BASE = "https://portal.invalid";

/**
 * Where to send someone after sign-in, from the `?next=` query param. Only
 * ever one of our own paths: the value is resolved the way a browser would
 * (so `/\evil.com` and `/\t/evil.com` collapse to `//evil.com`) and anything
 * that lands off our origin falls back. The default (and plain /apply) goes
 * through /continue, which sends submitted applicants to the dashboard and
 * everyone else to the form.
 */
export function safeNext(raw: string | null): string {
  const url = raw ? new URL(raw, BASE) : null;
  const next =
    url && url.origin === BASE ? url.pathname + url.search + url.hash : "/continue";
  return next === "/apply" ? "/continue" : next;
}
