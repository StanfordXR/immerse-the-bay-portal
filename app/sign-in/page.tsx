import { Suspense } from "react";
import { Brand } from "@/components/brand";
import type { Metadata } from "next";
import { SignInCard } from "@/components/sign-in-card";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The card reads ?next= via useSearchParams, so it must sit inside Suspense —
 * without it, the production build fails (and dev won't warn you).
 */
export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
      </header>
      <div className="flex flex-1 items-center justify-center py-10">
        <Suspense fallback={<div className="card h-120 w-full max-w-105" />}>
          <SignInCard />
        </Suspense>
      </div>
    </main>
  );
}
