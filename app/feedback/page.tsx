import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { Brand } from "@/components/brand";
import { FeedbackForm } from "@/components/feedback-form";

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  await requireUser();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand />
      </header>
      <div className="pb-20 pt-2">
        <p className="eyebrow mb-2">Stress test</p>
        <h1 className="font-display text-3xl font-bold">Portal feedback</h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">
          Two minutes, and every answer is optional. Friction points are the
          most valuable thing you can give us.
        </p>
        <div className="mt-8">
          <FeedbackForm />
        </div>
      </div>
    </main>
  );
}
