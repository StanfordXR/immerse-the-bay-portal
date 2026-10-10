"use client";

import { reviseApplication } from "@/lib/actions/decision";

export function ReviseApplicationButton() {
  return (
    <form
      action={reviseApplication}
      className="mt-6"
      onSubmit={(event) => {
        if (!window.confirm("Reopen this application? Your released decision and current reviews will be archived, and you must resubmit before the final deadline.")) {
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
