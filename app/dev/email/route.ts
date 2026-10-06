import { decisionReleasedHtml } from "@/lib/email";

/** Dev-only render of the decision "status update" email. 404s in production. */
export function GET(): Response {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  return new Response(decisionReleasedHtml("Ada"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
