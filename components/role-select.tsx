"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "@/lib/actions/admin";
import { ROLE_VALUES } from "@/lib/permissions";

/** Per-row role dropdown on /admin/users. Optimistic, reverts on failure. */
export function RoleSelect({
  userId,
  initialRole,
  isSelf,
}: {
  userId: string;
  initialRole: string;
  isSelf: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const previous = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const result = await setUserRole(userId, next).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (!result.ok) {
        setRole(previous);
        setError(("error" in result && result.error) || "Try again.");
      }
    });
  }

  if (isSelf) {
    return (
      <span
        className="font-mono text-[13px] text-faint"
        title="You cannot change your own role"
      >
        {role} (you)
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        className="field !w-auto !py-1.5 font-mono !text-[13px]"
        value={role}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        aria-label="Role"
      >
        {ROLE_VALUES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[12px] text-danger" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
