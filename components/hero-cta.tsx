"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

/**
 * The landing page is a static prerender, so the CTA reads optimistic cookies
 * client-side: submitted browsers (itb_applied) see "View your application",
 * returning browsers (itb_auth_hint) see "Continue your application", and
 * everyone else sees "Begin your application". Labels and destination only —
 * the proxy and sign-in page handle the rest.
 */
const subscribeNoop = () => () => {};
const getServerSnapshot = () => "new";
const getSnapshot = () => {
  if (document.cookie.includes("itb_applied=")) return "applied";
  if (document.cookie.includes("itb_auth_hint=")) return "returning";
  return "new";
};

export function HeroCta() {
  const state = useSyncExternalStore(subscribeNoop, getSnapshot, getServerSnapshot);

  const onClick = () => track("hero_cta_clicked", { state });

  if (state === "applied") {
    return (
      <Link
        href="/dashboard"
        className="btn-primary px-8 py-3.5 text-[17px]"
        onClick={onClick}
      >
        View your application
      </Link>
    );
  }
  return (
    <Link
      href="/apply"
      className="btn-primary px-8 py-3.5 text-[17px]"
      onClick={onClick}
    >
      {state === "returning" ? "Continue your application" : "Begin your application"}
    </Link>
  );
}
