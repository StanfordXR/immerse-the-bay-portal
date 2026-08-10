"use client";

import { useState, useTransition } from "react";
import { createTag, renameTag, setTagArchived } from "@/lib/actions/admin";

export type TagRow = {
  id: string;
  name: string;
  archived: boolean;
  uses: number;
};

export function TagManager({ tags }: { tags: TagRow[] }) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createTag(newName).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (result.ok) setNewName("");
      else setError(("error" in result && result.error) || "Try again.");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="field !w-72"
          placeholder="New tag, e.g. Standout, Hardware, Under 18"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary !py-2.5" disabled={pending}>
          Create
        </button>
      </form>
      {error && (
        <p className="text-[13.5px] text-danger" role="alert">
          {error}
        </p>
      )}

      {tags.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-2 bg-abyss/40 p-5 text-center text-[14px] text-faint">
          No tags yet. Create one above, then apply it from any application.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line/50">
          {tags.map((t) => (
            <TagRowItem key={t.id} tag={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TagRowItem({ tag }: { tag: TagRow }) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== tag.name;

  function save() {
    startTransition(async () => {
      const result = await renameTag(tag.id, name).catch(() => ({
        ok: false as const,
        error: "Network hiccup. Try again.",
      }));
      if (!result.ok) {
        setError(("error" in result && result.error) || "Try again.");
        setName(tag.name);
      } else setError(null);
    });
  }

  function toggleArchive() {
    startTransition(async () => {
      await setTagArchived(tag.id, !tag.archived).catch(() => undefined);
    });
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <input
        className={`field !w-64 !py-1.5 !text-[14px] ${tag.archived ? "opacity-50" : ""}`}
        value={name}
        maxLength={40}
        disabled={pending || tag.archived}
        onChange={(e) => setName(e.target.value)}
        aria-label={`Rename tag ${tag.name}`}
      />
      {dirty && !tag.archived && (
        <button
          type="button"
          className="btn-primary !px-3.5 !py-1.5 !text-[13px]"
          onClick={save}
          disabled={pending}
        >
          Save
        </button>
      )}
      <span className="font-mono text-[12.5px] tabular-nums text-faint">
        {tag.uses} use{tag.uses === 1 ? "" : "s"}
      </span>
      {tag.archived && (
        <span className="rounded-full border border-line-2 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-faint">
          archived
        </span>
      )}
      <span className="flex-1" />
      {error && <span className="text-[12.5px] text-danger">{error}</span>}
      <button
        type="button"
        className="btn-ghost !px-3.5 !py-1.5 !text-[13px]"
        onClick={toggleArchive}
        disabled={pending}
      >
        {tag.archived ? "Restore" : "Archive"}
      </button>
    </li>
  );
}
