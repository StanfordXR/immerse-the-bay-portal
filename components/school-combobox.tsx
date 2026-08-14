"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UNIVERSITY_SUGGESTIONS } from "@/lib/form-schema";

/**
 * Custom school picker replacing the native datalist, which testers hit two
 * walls with: after selecting a value the dropdown refuses to reopen (the
 * browser filters to the exact match), and nothing signals that free text is
 * allowed. This one always opens on focus, filters as you type, and pins an
 * explicit "Use ..." row so any school in the world is a valid answer.
 */
export function SchoolCombobox({
  id,
  value,
  onChange,
  describedBy,
  invalid,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  describedBy?: string;
  invalid: boolean;
  maxLength: number;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Filter only once they type in this focus session: reopening on a chosen
  // value must show the full list again (the native datalist's failure mode).
  const [typed, setTyped] = useState(false);

  const query = typed ? value.trim().toLowerCase() : "";
  const matches = query
    ? UNIVERSITY_SUGGESTIONS.filter((u) => u.toLowerCase().includes(query))
    : [...UNIVERSITY_SUGGESTIONS];
  const exactMatch = matches.some((u) => u.toLowerCase() === query);
  // The escape hatch row: whatever they typed is always accepted.
  const rows: string[] =
    query && !exactMatch ? [value.trim(), ...matches] : matches;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function choose(row: string) {
    onChange(row);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) {
      setOpen(true);
      setActive(0);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      setActive((a) => Math.min(a + 1, rows.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((a) => Math.max(a - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      // Only commit a highlight the user actually created by typing or
      // arrowing; Enter right after focus must not overwrite their school.
      if (active >= 0 && rows[active] !== undefined) {
        choose(rows[active]);
        e.preventDefault();
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        className="field"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        maxLength={maxLength}
        placeholder="Start typing, any school counts"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          setTyped(false);
          setActive(-1); // nothing highlighted until they type or arrow
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && rows.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="School suggestions"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-line-2 bg-surface p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
          {rows.map((row, i) => {
            const isCustom = query && !exactMatch && i === 0;
            return (
              <li
                key={`${row}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`cursor-pointer rounded-lg px-3 py-2 text-[14px] ${
                  i === active ? "bg-surface-2 text-moonlit" : "text-moonlit/85"
                }`}
                // Commit on click, not pointerdown: a touch scroll gesture
                // starts with pointerdown on some row, and committing there
                // both mis-selects and blocks scrolling the list.
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse") e.preventDefault(); // keep input focus
                }}
                onClick={() => choose(row)}
                onMouseEnter={() => setActive(i)}
              >
                {isCustom ? (
                  <>
                    Use <span className="font-medium text-cyan">{row}</span>
                  </>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
