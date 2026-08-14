"use client";

import { memo, useEffect, useId, useRef, type ReactNode } from "react";

/** Shared form primitives. Every input is labeled, described, and error-wired. */

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-balance text-[13.5px] font-medium text-muted">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-faint">optional</span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type ChipGroupProps = {
  options: readonly string[];
  labels?: Record<string, string>;
  values: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  ariaLabel: string;
};

/**
 * Memoized: big chip walls (27 skills) were re-rendering on every unrelated
 * keystroke and lagging older phones. The comparator ignores `onChange`
 * identity (callers pass inline lambdas); the latest one is kept in a ref so
 * clicks never see a stale closure.
 */
export const ChipGroup = memo(
  function ChipGroup({
    options,
    labels,
    values,
    onChange,
    multiple = false,
    ariaLabel,
  }: ChipGroupProps) {
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    });

    function toggle(option: string) {
      if (multiple) {
        onChangeRef.current(
          values.includes(option)
            ? values.filter((v) => v !== option)
            : [...values, option],
        );
      } else {
        onChangeRef.current(values.includes(option) ? [] : [option]);
      }
    }

    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={values.includes(option)}
            onClick={() => toggle(option)}
          >
            {labels?.[option] ?? option}
          </button>
        ))}
      </div>
    );
  },
  (prev, next) =>
    prev.options === next.options &&
    prev.labels === next.labels &&
    prev.multiple === next.multiple &&
    prev.ariaLabel === next.ariaLabel &&
    prev.values.length === next.values.length &&
    prev.values.every((v, i) => v === next.values[i]),
);

export function WordCount({ value, min, max }: { value: string; min?: number; max: number }) {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const under = min !== undefined && words > 0 && words < min;
  return (
    <span
      className={`font-mono text-[11.5px] tabular-nums ${
        words > max ? "text-danger" : "text-faint"
      }`}
      aria-hidden
    >
      {words}/{max} words
      {under ? ` · ${min - words} more word${min - words === 1 ? "" : "s"} needed` : ""}
    </span>
  );
}
