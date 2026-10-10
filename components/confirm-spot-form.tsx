"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/fields";
import { confirmSpot } from "@/lib/actions/decision";
import { track } from "@/lib/analytics";
import { TSHIRT_SIZES } from "@/lib/form-schema";
import { AGREEMENTS, DIETARY_OPTIONS, type AgreementKey, type RsvpForm } from "@/lib/rsvp";

const OTHER = "Other";

export type ConfirmSpotInitial = Omit<RsvpForm, "tshirtSize" | "agreements"> & {
  tshirtSize: string;
  agreements: Record<AgreementKey, boolean>;
};

/** Split a stored dietary answer into the dropdown choice and the "Other" text. */
function splitDietary(stored: string): { choice: string; other: string } {
  if (!stored) return { choice: "", other: "" };
  const match = DIETARY_OPTIONS.find((o) => o.toLowerCase() === stored.toLowerCase());
  return match ? { choice: match, other: "" } : { choice: OTHER, other: stored };
}

/**
 * The /rsvp form: logistics prefilled from the application, an emergency
 * contact, and the required agreements. Also used to edit a confirmation.
 */
export function ConfirmSpotForm({ initial, editing }: { initial: ConfirmSpotInitial; editing: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [dietary, setDietary] = useState(() => splitDietary(initial.dietary));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<ConfirmSpotInitial>) => setForm((f) => ({ ...f, ...patch }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    const payload = { ...form, dietary: dietary.choice === OTHER ? dietary.other : dietary.choice };
    startTransition(async () => {
      const result = await confirmSpot(payload).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
        fieldErrors: undefined,
      }));
      if (result.ok) {
        track("rsvp_submitted", { choice: editing ? "updated" : "confirmed" });
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setError(result.error);
      setErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <section className="card flex flex-col gap-5 p-6 sm:p-7">
        <h2 className="font-display text-[15px] font-semibold">Event details</h2>
        <Field label="T-shirt size" error={errors.tshirtSize}>
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              className="field"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={form.tshirtSize}
              onChange={(e) => set({ tshirtSize: e.target.value })}
            >
              <option value="">Pick a size</option>
              {TSHIRT_SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Dietary restrictions or preferences"
          hint="We will do our best to provide alternatives for everyone's dietary restrictions, but this may not be possible for all meals."
          error={errors.dietary}
        >
          {({ id, describedBy, invalid }) => (
            <div className="flex flex-col gap-2.5">
              <select
                id={id}
                className="field"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={dietary.choice}
                onChange={(e) => setDietary((d) => ({ ...d, choice: e.target.value }))}
              >
                <option value="">Pick one</option>
                {DIETARY_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
                <option>{OTHER}</option>
              </select>
              {dietary.choice === OTHER && (
                <input
                  className="field"
                  aria-label="Describe your dietary needs"
                  placeholder="e.g. vegetarian, no shellfish"
                  maxLength={300}
                  value={dietary.other}
                  onChange={(e) => setDietary((d) => ({ ...d, other: e.target.value }))}
                />
              )}
            </div>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Pronouns" optional error={errors.pronouns}>
            {({ id, describedBy }) => (
              <input
                id={id}
                className="field"
                aria-describedby={describedBy}
                maxLength={60}
                value={form.pronouns}
                onChange={(e) => set({ pronouns: e.target.value })}
              />
            )}
          </Field>
          <Field label="Phone number" hint="For day-of contact" optional error={errors.phone}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="tel"
                autoComplete="tel"
                className="field"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-5 p-6 sm:p-7">
        <h2 className="font-display text-[15px] font-semibold">Emergency contact</h2>
        <Field label="Name" error={errors.emergencyName}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className="field"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={120}
              value={form.emergencyName}
              onChange={(e) => set({ emergencyName: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={errors.emergencyEmail}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="email"
                className="field"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={form.emergencyEmail}
                onChange={(e) => set({ emergencyEmail: e.target.value })}
              />
            )}
          </Field>
          <Field label="Phone number" error={errors.emergencyPhone}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="tel"
                className="field"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={form.emergencyPhone}
                onChange={(e) => set({ emergencyPhone: e.target.value })}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-6 sm:p-7">
        <h2 className="font-display text-[15px] font-semibold">Agreements</h2>
        {AGREEMENTS.map((a) => {
          const err = errors[`agreements.${a.key}`];
          return (
            <div key={a.key} className="flex flex-col gap-1">
              <label className="flex items-start gap-3 text-[14px] leading-relaxed text-moonlit/90">
                <input
                  type="checkbox"
                  className="mt-1 size-4 flex-none accent-cyan"
                  aria-invalid={Boolean(err)}
                  checked={form.agreements[a.key]}
                  onChange={(e) => set({ agreements: { ...form.agreements, [a.key]: e.target.checked } })}
                />
                <span>
                  {a.label}
                  {"href" in a && (
                    <>
                      {" "}
                      <a
                        href={a.href}
                        target="_blank"
                        rel="noopener"
                        className="text-cyan underline-offset-2 hover:underline"
                      >
                        Read the Code of Conduct ↗
                      </a>
                    </>
                  )}
                </span>
              </label>
              {err && (
                <p className="ml-7 text-[13px] text-danger" role="alert">
                  Required
                </p>
              )}
            </div>
          );
        })}
      </section>

      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "One moment…" : editing ? "Save changes" : "Confirm my spot"}
        </button>
        <Link href="/dashboard" className="btn-ghost">
          Back
        </Link>
      </div>
    </form>
  );
}
