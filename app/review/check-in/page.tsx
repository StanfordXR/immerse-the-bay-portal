import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { CheckInDesk } from "@/components/check-in-desk";
import { ReviewerTabs } from "@/components/reviewer-tabs";
import { requireReviewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Check-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  await requireReviewer();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <Brand suffix="/ REVIEW" />
        <Link href="/dashboard" className="btn-ghost !py-2 text-[14px]">
          Dashboard
        </Link>
      </header>
      <ReviewerTabs current="check-in" />
      <div className="flex flex-col gap-6 pb-20 pt-7">
        <div>
          <p className="eyebrow mb-2">Event staff</p>
          <h1 className="font-display text-3xl font-semibold">Attendee check-in</h1>
          <p className="mt-2 text-sm text-muted">Find a confirmed hacker by name, or scan a hacker or staff member’s QR code from My Badge.</p>
        </div>
        <CheckInDesk />
      </div>
    </main>
  );
}
