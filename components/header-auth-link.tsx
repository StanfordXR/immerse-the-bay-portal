"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Landing-header account button. The landing page is a static prerender, so
 * the server can't know who's visiting; without this, signed-in users saw a
 * "Sign in" button and assumed they'd been logged out. The auth-hint cookie
 * is optimistic, not proof of a session — worst case, a signed-out visitor
 * clicks "Dashboard" and lands on the sign-in page.
 */
const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;
const hasAuthHint = () => document.cookie.includes("itb_auth_hint=");

export function HeaderAuthLink() {
  const returning = useSyncExternalStore(
    subscribeNoop,
    hasAuthHint,
    getServerSnapshot,
  );

  return (
    <Link
      href={returning ? "/dashboard" : "/sign-in"}
      className="btn-ghost !py-2 text-[15px]"
    >
      {returning ? "Dashboard" : "Sign in"}
    </Link>
  );
}
