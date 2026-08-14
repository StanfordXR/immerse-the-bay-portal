"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  COUNTRIES,
  ESSAY_LIMITS,
  GRAD_YEARS,
  HACKATHON_BUCKETS,
  HACKATHON_BUCKET_LABELS,
  PRIOR_ATTENDANCE,
  HEARD_OPTIONS,
  PRIMARY_SKILLS,
  PRONOUN_OPTIONS,
  SKILL_CHIPS,
  STEPS,
  TSHIRT_SIZES,
  US_STATES,
  stepIssues,
  type Answers,
  type StepIndex,
} from "@/lib/form-schema";
import { saveDraft, submitApplication } from "@/lib/actions/application";
import { track } from "@/lib/analytics";
import { Stepper } from "@/components/stepper";
import { ChipGroup, Field, WordCount } from "@/components/fields";
import { SchoolCombobox } from "@/components/school-combobox";

// Sources where a specific person sent them our way.
const HEARD_NAMEABLE = new Set<string>([
  "Friend or classmate",
  "Class or professor",
  "Partner club at my school",
]);

type SaveState =
  | "idle"
  | "saving"
  | "saved"
  | "invalid"
  | "signed-out"
  | "closed"
  | "offline";

function stateFromSaveError(error: string): SaveState {
  if (error === "invalid") return "invalid";
  if (error === "signed-out") return "signed-out";
  if (error === "closed") return "closed";
  return "offline";
}


export function ApplyForm({
  initialAnswers,
  alreadySubmitted,
  closeLabel,
  preview = false,
}: {
  initialAnswers: Answers;
  alreadySubmitted: boolean;
  closeLabel: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [step, setStep] = useState<StepIndex>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dirty = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const set = useCallback((patch: Partial<Answers>) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, ...patch }));
    // clear errors for fields being edited
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }, []);

  // ── autosave: debounced, tolerant, honest about state ──────────────────────
  // Every save sends the *latest* answers and carries a sequence number: a
  // slow older request can neither report state over a newer one nor clobber
  // newer keystrokes with a stale payload.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  });
  const saveSeq = useRef(0);
  const retryCount = useRef(0);

  useEffect(() => {
    if (!dirty.current || preview) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const seq = ++saveSeq.current;
      try {
        const result = await saveDraft(answersRef.current);
        if (seq !== saveSeq.current) return; // a newer save superseded this one
        if (result.ok) retryCount.current = 0;
        setSaveState(result.ok ? "saved" : stateFromSaveError(result.error));
      } catch {
        if (seq === saveSeq.current) setSaveState("offline");
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [answers, preview]);

  // Real retry while offline: up to 5 attempts, 5 seconds apart. The tick
  // bumps on every failure so the effect always re-arms (a same-value
  // setSaveState alone would not re-render). Any successful edit-save resets
  // the budget.
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (saveState !== "offline" || preview) return;
    if (retryCount.current >= 5) return; // give up; the next edit retries
    const timer = setTimeout(async () => {
      retryCount.current += 1;
      const seq = ++saveSeq.current;
      try {
        const result = await saveDraft(answersRef.current);
        if (seq !== saveSeq.current) return;
        if (result.ok) {
          retryCount.current = 0;
          setSaveState("saved");
        } else {
          setSaveState(stateFromSaveError(result.error));
          setRetryTick((t) => t + 1);
        }
      } catch {
        if (seq === saveSeq.current) {
          setSaveState("offline");
          setRetryTick((t) => t + 1);
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [saveState, retryTick, preview]);

  function goTo(next: StepIndex) {
    setStep(next);
  }

  // Scroll after the new step has painted; doing it inside goTo raced the
  // re-render and silently lost on mobile (stress-test report).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ block: "start" });
    track("application_step_viewed", { step: STEPS[step].id });
  }, [step]);

  function handleNext() {
    const issues = stepIssues(answers, step);
    if (Object.keys(issues).length > 0) {
      setErrors(issues);
      return;
    }
    track("apply_step_completed", { step: STEPS[step].id });
    goTo((step + 1) as StepIndex);
  }

  // Furthest step reachable by clicking the stepper: first incomplete step,
  // or wherever the user already is, whichever is greater.
  let furthestValid = step;
  for (let i = 0; i < 4; i++) {
    if (Object.keys(stepIssues(answers, i as StepIndex)).length === 0) {
      furthestValid = Math.max(furthestValid, i + 1) as StepIndex;
    } else {
      break;
    }
  }

  async function handleSubmit() {
    if (preview) {
      setSubmitError("Preview mode — submission is disabled here.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitApplication(answers);
      if (result.ok) {
        track(alreadySubmitted ? "application_updated" : "application_submitted", {
          source: answers.heardAboutUs,
        });
        // Edits return to a calm dashboard; only first submits get the
        // celebration banner.
        router.push(alreadySubmitted ? "/dashboard" : "/dashboard?submitted=1");
        return;
      }
      setSubmitError(result.error);
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
        const firstBad = STEPS.findIndex((s) =>
          s.fields.some((f) => result.fieldErrors![f]),
        );
        if (firstBad >= 0) goTo(firstBad as StepIndex);
      }
    } catch {
      setSubmitError("Something went wrong. Your draft is saved, try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResume(file: File) {
    setUploadError(null);
    if (file.type !== "application/pdf") {
      setUploadError("PDF only, please.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Keep it under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const blob = await upload(`resumes/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      set({ resumeUrl: blob.url });
      track("resume_uploaded");
    } catch {
      setUploadError("Upload failed. You can also submit without a resume.");
    } finally {
      setUploading(false);
    }
  }

  const a = answers;

  return (
    <div ref={topRef} className="flex flex-col gap-8 scroll-mt-24">
      <Stepper
        steps={STEPS}
        current={step}
        furthestValid={furthestValid}
        onNavigate={(i) => goTo(i as StepIndex)}
      />

      <div className="card p-6 sm:p-8">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <p className="eyebrow">Step {step + 1} of {STEPS.length}</p>
            <h2 className="font-display mt-1 text-xl font-semibold sm:text-2xl">
              {STEPS[step].title}
            </h2>
          </div>
          <SaveBadge state={preview ? "idle" : saveState} preview={preview} />
        </header>

        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    className="field"
                    autoComplete="given-name"
                    maxLength={100}
                    value={a.firstName ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => set({ firstName: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Last name" error={errors.lastName}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    className="field"
                    autoComplete="family-name"
                    maxLength={100}
                    value={a.lastName ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => set({ lastName: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Pronouns" optional error={errors.pronouns}>
                {({ id, describedBy }) => (
                  <select
                    id={id}
                    className="field"
                    value={a.pronouns ?? ""}
                    aria-describedby={describedBy}
                    onChange={(e) => set({ pronouns: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {PRONOUN_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {a.pronouns === "self-describe" && (
                <Field label="Your pronouns" error={errors.pronounsSelf}>
                  {({ id, describedBy, invalid }) => (
                    <input
                      id={id}
                      className="field"
                      maxLength={60}
                      value={a.pronounsSelf ?? ""}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      onChange={(e) => set({ pronounsSelf: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </div>

            <Field
              label="Date of birth"
              hint="Attendees must be 18+ on November 13, 2026."
              error={errors.dateOfBirth}
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  type="date"
                  className="field w-full min-w-0 sm:max-w-60"
                  autoComplete="bday"
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={a.dateOfBirth ?? ""}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => set({ dateOfBirth: e.target.value })}
                />
              )}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <Field label="University or organization" error={errors.schoolName}>
              {({ id, describedBy, invalid }) => (
                <SchoolCombobox
                  id={id}
                  value={a.schoolName ?? ""}
                  onChange={(schoolName) => set({ schoolName })}
                  describedBy={describedBy}
                  invalid={invalid}
                  maxLength={200}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Country" error={errors.schoolCountry}>
                {({ id, describedBy, invalid }) => (
                  <select
                    id={id}
                    className="field"
                    autoComplete="country-name"
                    value={a.schoolCountry ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) =>
                      set({ schoolCountry: e.target.value, schoolRegion: "" })
                    }
                  >
                    <option value="">Select…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {a.schoolCountry === "United States" && (
                <Field label="State" error={errors.schoolRegion}>
                  {({ id, describedBy, invalid }) => (
                    <select
                      id={id}
                      className="field"
                      value={a.schoolRegion ?? ""}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      onChange={(e) => set({ schoolRegion: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Graduation year" error={errors.gradYear}>
                {({ id, describedBy, invalid }) => (
                  <select
                    id={id}
                    className="field"
                    value={a.gradYear ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) =>
                      set({ gradYear: e.target.value as Answers["gradYear"] })
                    }
                  >
                    <option value="">Select…</option>
                    {GRAD_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Your primary skill" error={errors.primarySkill}>
                {({ id, describedBy, invalid }) => (
                  <select
                    id={id}
                    className="field"
                    value={a.primarySkill ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) =>
                      set({
                        primarySkill: e.target.value as Answers["primarySkill"],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {PRIMARY_SKILLS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Hackathons attended before" error={errors.hackathonsBucket}>
                {() => (
                  <ChipGroup
                    ariaLabel="Hackathons attended"
                    options={HACKATHON_BUCKETS}
                    labels={HACKATHON_BUCKET_LABELS}
                    values={a.hackathonsBucket ? [a.hackathonsBucket] : []}
                    onChange={([v]) =>
                      set({
                        hackathonsBucket: (v ?? undefined) as Answers["hackathonsBucket"],
                      })
                    }
                  />
                )}
              </Field>
              <Field
                label="Immerse the Bays attended before"
                error={errors.priorAttendance}
              >
                {() => (
                  <ChipGroup
                    ariaLabel="Immerse the Bays attended before"
                    options={PRIOR_ATTENDANCE}
                    values={a.priorAttendance ? [a.priorAttendance] : []}
                    onChange={([v]) =>
                      set({
                        priorAttendance: (v ?? undefined) as Answers["priorAttendance"],
                      })
                    }
                  />
                )}
              </Field>
            </div>

            <Field
              label="Skills"
              optional
              hint="Tap everything that applies. Reviewers use these to balance teams of builders, artists, and designers."
            >
              {() => (
                <ChipGroup
                  ariaLabel="Skills"
                  multiple
                  options={SKILL_CHIPS}
                  values={a.skills ?? []}
                  onChange={(skills) => set({ skills })}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Anything else you're good at?" optional>
                {({ id }) => (
                  <input
                    id={id}
                    className="field"
                    placeholder="e.g. shader wizardry, pitch decks"
                    maxLength={300}
                    value={a.skillsOther ?? ""}
                    onChange={(e) => set({ skillsOther: e.target.value })}
                  />
                )}
              </Field>
              <Field
                label="Links: LinkedIn, GitHub, portfolio"
                optional
                hint="Multiple links welcome, separated by commas."
                error={errors.portfolioUrl}
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    className="field"
                    inputMode="url"
                    placeholder="linkedin.com/in/you, github.com/you"
                    maxLength={600}
                    value={a.portfolioUrl ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => set({ portfolioUrl: e.target.value })}
                  />
                )}
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <Field
              label="Why do you want to be at Immerse the Bay, and what do you hope to get out of it?"
              hint="20 to 200 words. A short paragraph is perfect. Specific beats polished: tell us what you actually want to build or learn."
              error={errors.whyParticipate}
            >
              {({ id, describedBy, invalid }) => (
                <>
                  <textarea
                    id={id}
                    className="field min-h-40 resize-y"
                    maxLength={3000}
                    value={a.whyParticipate ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => set({ whyParticipate: e.target.value })}
                  />
                  <div className="flex justify-end">
                    <WordCount
                      value={a.whyParticipate ?? ""}
                      min={ESSAY_LIMITS.whyParticipate.min}
                      max={ESSAY_LIMITS.whyParticipate.max}
                    />
                  </div>
                </>
              )}
            </Field>

            <Field
              label="If you could ask an XR industry CEO one question, what would it be?"
              hint="3 to 50 words."
              error={errors.ceoQuestion}
            >
              {({ id, describedBy, invalid }) => (
                <>
                  <textarea
                    id={id}
                    className="field min-h-24 resize-y"
                    maxLength={800}
                    value={a.ceoQuestion ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => set({ ceoQuestion: e.target.value })}
                  />
                  <div className="flex justify-end">
                    <WordCount
                      value={a.ceoQuestion ?? ""}
                      min={ESSAY_LIMITS.ceoQuestion.min}
                      max={ESSAY_LIMITS.ceoQuestion.max}
                    />
                  </div>
                </>
              )}
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <Field label="T-shirt size" error={errors.tshirtSize}>
              {() => (
                <ChipGroup
                  ariaLabel="T-shirt size"
                  options={TSHIRT_SIZES}
                  values={a.tshirtSize ? [a.tshirtSize] : []}
                  onChange={([v]) =>
                    set({ tshirtSize: (v ?? undefined) as Answers["tshirtSize"] })
                  }
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Dietary needs"
                optional
                hint="e.g. vegetarian, halal, peanut allergy"
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className="field"
                    maxLength={300}
                    value={a.dietaryNeeds ?? ""}
                    aria-describedby={describedBy}
                    onChange={(e) => set({ dietaryNeeds: e.target.value })}
                  />
                )}
              </Field>
              <Field
                label="Accessibility needs"
                optional
                hint="Anything that'll help make the weekend work"
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className="field"
                    maxLength={500}
                    value={a.accessibilityNeeds ?? ""}
                    aria-describedby={describedBy}
                    onChange={(e) => set({ accessibilityNeeds: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="How did you hear about us?" error={errors.heardAboutUs}>
                {({ id, describedBy, invalid }) => (
                  <select
                    id={id}
                    className="field"
                    value={a.heardAboutUs ?? ""}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => {
                      const heardAboutUs = e.target.value as Answers["heardAboutUs"];
                      set(
                        HEARD_NAMEABLE.has(e.target.value)
                          ? { heardAboutUs }
                          : { heardAboutUs, heardAboutUsName: "" },
                      );
                    }}
                  >
                    <option value="">Select…</option>
                    {HEARD_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {HEARD_NAMEABLE.has(a.heardAboutUs ?? "") && (
                <Field
                  label="Who? Name-drop them"
                  optional
                  hint="They earn eternal glory."
                >
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      className="field"
                      placeholder="e.g. Steven Le"
                      maxLength={100}
                      value={a.heardAboutUsName ?? ""}
                      aria-describedby={describedBy}
                      onChange={(e) => set({ heardAboutUsName: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </div>

            {/* resume + its sharing consent live together */}
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-abyss/40 p-4 sm:p-5">
              <Field
                label="Resume"
                optional
                hint="PDF, up to 5 MB."
                error={uploadError ?? undefined}
              >
                {({ id, describedBy }) => (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      id={id}
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      aria-describedby={describedBy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleResume(file);
                        e.target.value = "";
                      }}
                    />
                    <label htmlFor={id} className="btn-ghost cursor-pointer">
                      {uploading
                        ? "Uploading…"
                        : a.resumeUrl
                          ? "Replace PDF"
                          : "Upload PDF"}
                    </label>
                    {a.resumeUrl && !uploading && (
                      <span className="flex items-center gap-2 text-[13.5px] text-ok">
                        Attached ✓
                        <button
                          type="button"
                          className="text-muted underline underline-offset-2 hover:text-moonlit"
                          onClick={() => set({ resumeUrl: "" })}
                        >
                          remove
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </Field>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[--color-cyan-2]"
                  checked={a.sponsorShareOk ?? false}
                  onChange={(e) => set({ sponsorShareOk: e.target.checked })}
                />
                <span className="text-[14px] leading-relaxed text-muted">
                  Share my resume and contact info with event sponsors for
                  recruiting.{" "}
                  <span className="text-faint">
                    Entirely optional. It has no effect on your application.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <ReviewStep
            answers={a}
            onEdit={(i) => goTo(i)}
            alreadySubmitted={alreadySubmitted}
          />
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          {step > 0 ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => goTo((step - 1) as StepIndex)}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <button type="button" className="btn-primary" onClick={handleNext}>
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting
                ? alreadySubmitted
                  ? "Saving…"
                  : "Submitting…"
                : alreadySubmitted
                  ? "Save changes"
                  : "Submit application"}
            </button>
          )}
        </div>

        {submitError && (
          <p className="mt-4 text-right text-[13.5px] text-danger" role="alert">
            {submitError}
          </p>
        )}
      </div>

      <p className="text-center text-[13px] text-faint">
        Priority round closes {closeLabel}. Your progress is automatically
        saved. Come back and edit anytime, even after submitting. By submitting
        you agree to our{" "}
        <a
          href="/privacy"
          target="_blank"
          className="text-cyan underline-offset-2 hover:underline"
        >
          privacy policy
        </a>
        .
      </p>
    </div>
  );
}

function SaveBadge({ state, preview }: { state: SaveState; preview: boolean }) {
  if (preview) {
    return <span className="font-mono text-[11px] text-faint">PREVIEW</span>;
  }
  const LABELS: Record<SaveState, string> = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    invalid: "Draft not saved, an answer is too long",
    "signed-out": "Signed out, sign in to keep saving",
    closed: "Applications closed",
    offline: "Not saved, check your connection",
  };
  const label = LABELS[state];
  if (!label) return null;
  const danger = !["saving", "saved"].includes(state);
  return (
    <span
      className={`font-mono text-[11px] tracking-wide ${
        danger ? "text-danger" : "text-faint"
      }`}
      aria-live="polite"
    >
      {state === "saved" && <span className="mr-1 text-ok">●</span>}
      {label}
    </span>
  );
}

function ReviewStep({
  answers: a,
  onEdit,
  alreadySubmitted,
}: {
  answers: Answers;
  onEdit: (step: StepIndex) => void;
  alreadySubmitted: boolean;
}) {
  const sections: Array<{
    step: StepIndex;
    title: string;
    rows: Array<[string, string | undefined]>;
  }> = [
    {
      step: 0,
      title: "Identity",
      rows: [
        ["Name", [a.firstName, a.lastName].filter(Boolean).join(" ")],
        [
          "Pronouns",
          a.pronouns === "self-describe" ? a.pronounsSelf : a.pronouns,
        ],
        ["Date of birth", a.dateOfBirth],
      ],
    },
    {
      step: 1,
      title: "Background",
      rows: [
        ["School", a.schoolName],
        [
          "Location",
          [a.schoolRegion, a.schoolCountry].filter(Boolean).join(", "),
        ],
        ["Graduation", a.gradYear],
        ["Hackathons", a.hackathonsBucket && HACKATHON_BUCKET_LABELS[a.hackathonsBucket]],
        ["Immerse the Bays attended", a.priorAttendance],
        ["Primary skill", a.primarySkill],
        ["Skills", a.skills?.length ? a.skills.join(", ") : undefined],
        ["Portfolio", a.portfolioUrl],
      ],
    },
    {
      step: 2,
      title: "Your Story",
      rows: [
        ["Why Immerse the Bay", a.whyParticipate],
        ["Question for a CEO", a.ceoQuestion],
      ],
    },
    {
      step: 3,
      title: "Logistics",
      rows: [
        ["T-shirt", a.tshirtSize],
        ["Dietary", a.dietaryNeeds],
        ["Accessibility", a.accessibilityNeeds],
        ["Resume", a.resumeUrl ? "Attached ✓" : "None"],
        [
          "Heard about us via",
          a.heardAboutUsName
            ? `${a.heardAboutUs} (${a.heardAboutUsName})`
            : a.heardAboutUs,
        ],
        ["Sponsor resume sharing", a.sponsorShareOk ? "Yes" : "No"],
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[14.5px] leading-relaxed text-muted">
        {alreadySubmitted
          ? "Your application is already in. Saving updates it in place, it never creates a second application."
          : "One last look before launch. You can still edit after submitting, right up until applications close."}
      </p>
      {sections.map((section) => (
        <section key={section.title} className="rounded-xl border border-line bg-abyss/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold">
              {section.title}
            </h3>
            <button
              type="button"
              className="text-[13px] text-cyan underline-offset-2 hover:underline"
              onClick={() => onEdit(section.step)}
            >
              Edit
            </button>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[10rem_minmax(0,1fr)]">
            {section.rows
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-faint">{label}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words text-moonlit/90 [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
