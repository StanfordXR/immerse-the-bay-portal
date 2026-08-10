"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/** Returning browsers (auth-hint cookie) see "Continue your application";
 *  everyone else sees "Begin your application". Label only — the destination
 *  is /apply either way, and the proxy + sign-in page handle the rest. */
const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;
const hasAuthHint = () => document.cookie.includes("itb_auth_hint=");

export function HeroCta() {
  const returning = useSyncExternalStore(
    subscribeNoop,
    hasAuthHint,
    getServerSnapshot,
  );

  return (
    <Link href="/apply" className="btn-primary px-8 py-3.5 text-[17px]">
      {returning ? "Continue your application" : "Begin your application"}
    </Link>
  );
}
