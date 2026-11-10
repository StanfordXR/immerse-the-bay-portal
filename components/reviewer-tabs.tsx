import Link from "next/link";

export function ReviewerTabs({ current }: { current: "review" | "check-in" }) {
  return (
    <nav aria-label="Reviewer pages" className="flex gap-1 border-b border-line">
      {[
        { id: "review", href: "/review", label: "Review queue" },
        { id: "check-in", href: "/review/check-in", label: "Check-in" },
      ].map(({ id, href, label }) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${current === id ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-moonlit"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
