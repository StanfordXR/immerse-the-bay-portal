import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/apply-form";

/**
 * Dev-only rendering of the form without auth or a database — for visual work
 * and screenshots. 404s in production.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-6">
      <div className="mb-8">
        <p className="eyebrow mb-2">Application · 2026 · preview</p>
        <h1 className="font-display text-3xl font-bold">
          Your metamorphosis begins
        </h1>
      </div>
      <ApplyForm
        initialAnswers={{ firstName: "Ada", lastName: "Lovelace" }}
        alreadySubmitted={false}
        deadlineNote="Priority round closes October 2."
        preview
      />
    </main>
  );
}
