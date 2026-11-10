"use client";

import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CheckInPerson, CheckInResult } from "@/lib/check-in-types";
import { CheckInScanner } from "@/components/check-in-scanner";

type CheckInRequest =
  | { action: "search"; query: string }
  | { action: "manual"; id: string }
  | { action: "scan"; code: string };
const formatTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Los_Angeles",
});

export function CheckInDesk() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<CheckInPerson[] | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const pending = useRef(false);

  const send = useCallback(async (request: CheckInRequest) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    if (request.action === "search") setPeople(null);
    try {
      const response = await fetch("/api/review/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Check-in is unavailable. Please try again.");
      }
      if (request.action === "search") {
        const data: { people: CheckInPerson[] } = await response.json();
        setPeople(data.people);
      } else {
        const data: CheckInResult = await response.json();
        setResult(data);
        setPeople((current) => current?.map((person) => person.id === data.person.id ? data.person : person) ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check-in is unavailable. Please try again.");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }, []);

  const onCode = useCallback((code: string) => { void send({ action: "scan", code }); }, [send]);
  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scanning && query.trim().length >= 2) void send({ action: "search", query });
  }

  return (
    <div className="ph-no-capture space-y-4">
      <div aria-live="polite" className="text-sm">
        {busy && <p className="text-muted">Working…</p>}
        {result && (
          <p className="card border-ok/50 p-4 font-semibold text-ok">
            {result.person.name}: {result.alreadyCheckedIn ? "already checked in" : "checked in"}
            {result.person.checkedInAt && ` · ${formatTime.format(new Date(result.person.checkedInAt))} PT`}
          </p>
        )}
      </div>
      {error && <p className="card border-danger/50 p-4 text-sm text-danger" role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="card h-fit space-y-4 p-5" aria-labelledby="search-title">
          <h2 className="font-display text-lg font-semibold" id="search-title">Find an attendee</h2>
          <form className="flex flex-wrap items-end gap-2" onSubmit={onSearch}>
            <div className="min-w-44 flex-1">
              <label htmlFor="check-in-search" className="mb-1 block text-sm text-muted">Name or exact email</label>
              <input
                autoComplete="off"
                id="check-in-search"
                type="search"
                maxLength={100}
                className="field w-full"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={busy || scanning || query.trim().length < 2}>Search</button>
          </form>
          {people && (
            <div aria-live="polite">
              {people.length ? (
                <ul className="divide-y divide-line">
                  {people.map((person) => (
                    <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0 break-words">
                        <p className="font-semibold">{person.name}</p>
                        <p className="text-xs text-muted">{person.emailHint}</p>
                      </div>
                      {person.checkedInAt ? (
                        <span className="text-sm font-semibold text-ok">Checked in</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost !py-2"
                          disabled={busy || scanning}
                          aria-label={`Check in ${person.name}`}
                          onClick={() => void send({ action: "manual", id: person.id })}
                        >
                          Check in
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No confirmed attendees match. Try a different spelling or the email they used to sign up.</p>}
              {people.length === 15 && <p className="text-xs text-muted">Showing up to 15 matches. Add another part of the name to narrow the search.</p>}
            </div>
          )}
        </section>
        <CheckInScanner disabled={busy} onCode={onCode} scanning={scanning} setScanning={setScanning} />
      </div>
    </div>
  );
}
