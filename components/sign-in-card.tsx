"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";
type Method = "google" | "github" | "email";

const HINT_COOKIE = "itb_auth_hint";

/** Remember which method this browser last authenticated with — a UX hint
 *  only (js-readable, non-sensitive), used for the "Last used" badge and to
 *  default returning browsers to sign-in mode. */
function rememberMethod(method: Method) {
  document.cookie = `${HINT_COOKIE}=${method}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function readMethod(): Method | null {
  const match = document.cookie.match(new RegExp(`${HINT_COOKIE}=(google|github|email)`));
  return (match?.[1] as Method) ?? null;
}

// Cookie-as-external-store: server snapshot is null (no document during SSR),
// client snapshot reads the hint. No subscription — it can't change under us.
const subscribeNoop = () => () => {};
const getServerSnapshot = () => null;

/** Corner badge straddling the top border — the Clerk/Vercel pattern: the box
 *  is highlighted, the label stays centered, the pill sits on the border. */
function LastUsedBadge() {
  return (
    <span
      className="pointer-events-none absolute -top-[9px] right-3.5 rounded-full px-2 py-[1.5px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-cyan"
      style={{
        background: "var(--color-surface)",
        border: "1px solid color-mix(in oklab, var(--color-cyan-2) 70%, transparent)",
      }}
    >
      last used
    </span>
  );
}

const highlightStyle = {
  borderColor: "var(--color-cyan-2)",
  boxShadow: "0 0 12px color-mix(in oklab, var(--color-cyan) 18%, transparent)",
} as const;

/** Only ever bounce to our own paths — never to an absolute URL from the query string. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/apply";
}

export function SignInCard() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "sign-up" : "sign-in",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastMethod = useSyncExternalStore(
    subscribeNoop,
    readMethod,
    getServerSnapshot,
  );

  async function social(provider: "google" | "github") {
    setBusy(provider);
    setError(null);
    rememberMethod(provider);
    try {
      await authClient.signIn.social({ provider, callbackURL: next });
      // browser navigates away; nothing after this runs on success
    } catch {
      setError("Couldn't reach the sign-in service. Try again.");
      setBusy(null);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email, password })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(
        result.error.message ??
          (mode === "sign-up"
            ? "Couldn't create that account."
            : "Wrong email or password."),
      );
      setBusy(null);
      return;
    }
    rememberMethod("email");
    router.push(next);
  }

  return (
    <div className="card w-full max-w-105 p-7 sm:p-9">
      <h1 className="font-display text-2xl font-semibold">
        {mode === "sign-in" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">
        {mode === "sign-in"
          ? "Sign in to continue your application."
          : "Your application starts with an account — takes ten seconds."}
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          className="btn-ghost relative w-full"
          style={lastMethod === "google" ? highlightStyle : undefined}
          disabled={busy !== null}
          onClick={() => void social("google")}
        >
          {lastMethod === "google" && <LastUsedBadge />}
          <GoogleIcon />
          {busy === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        <button
          type="button"
          className="btn-ghost relative w-full"
          style={lastMethod === "github" ? highlightStyle : undefined}
          disabled={busy !== null}
          onClick={() => void social("github")}
        >
          {lastMethod === "github" && <LastUsedBadge />}
          <GitHubIcon />
          {busy === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          or with email
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        onSubmit={(e) => void submitEmail(e)}
        className={`flex flex-col gap-3.5 ${
          lastMethod === "email" ? "relative rounded-xl border p-4" : ""
        }`}
        style={lastMethod === "email" ? highlightStyle : undefined}
      >
        {lastMethod === "email" && <LastUsedBadge />}
        {mode === "sign-up" && (
          <div>
            <label htmlFor="si-name" className="mb-1.5 block text-[13.5px] font-medium text-muted">
              Full name
            </label>
            <input
              id="si-name"
              className="field"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="si-email" className="mb-1.5 block text-[13.5px] font-medium text-muted">
            Email
          </label>
          <input
            id="si-email"
            type="email"
            className="field"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="si-pass" className="mb-1.5 block text-[13.5px] font-medium text-muted">
            Password
          </label>
          <input
            id="si-pass"
            type="password"
            className="field"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "sign-up" && (
            <p className="mt-1.5 text-[12.5px] text-faint">
              At least 10 characters.
            </p>
          )}
        </div>

        {error && (
          <p className="text-[13.5px] text-danger" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary mt-1 w-full"
          disabled={busy !== null}
        >
          {busy === "email"
            ? "One moment…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13.5px] text-muted">
        {mode === "sign-in" ? (
          <>
            First time here?{" "}
            <button
              type="button"
              className="text-cyan underline-offset-2 hover:underline"
              onClick={() => {
                setMode("sign-up");
                setError(null);
              }}
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already applied?{" "}
            <button
              type="button"
              className="text-cyan underline-offset-2 hover:underline"
              onClick={() => {
                setMode("sign-in");
                setError(null);
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.29a12 12 0 0 0 0 10.78l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
