"use client";

import { reviseApplication } from "@/lib/actions/decision";

export function ReviseApplicationButton({ deadline }: { deadline: string }) {
  return (
    <form
      action={reviseApplication}
      className="mt-6"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Ready to revise? We'll open a new version of your application for you to update. Submit it by ${deadline} at 11:59 PM PDT to be considered in the regular round.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn-primary">
        Revise my application
      </button>
    </form>
  );
}
