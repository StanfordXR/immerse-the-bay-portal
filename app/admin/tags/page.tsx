import Link from "next/link";
import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { TagManager } from "@/components/tag-manager";
import { db } from "@/lib/db";
import { applicationTag, tag } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Tags" };

export default async function AdminTagsPage() {
  await requireAdmin();

  const tags = await db
    .select({
      id: tag.id,
      name: tag.name,
      archived: tag.archived,
      uses: sql<number>`count(${applicationTag.id})::int`,
    })
    .from(tag)
    .leftJoin(applicationTag, sql`${applicationTag.tagId} = ${tag.id}`)
    .groupBy(tag.id)
    .orderBy(asc(tag.archived), asc(tag.name));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ TAGS" />
        <Link href="/admin" className="btn-ghost !py-2 text-[14px]">
          ← Admin
        </Link>
      </header>

      <div className="flex flex-col gap-6 pb-20 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tags</h1>
          <p className="mt-1 max-w-prose text-[14px] text-muted">
            Applied to applications from their detail pages, filterable in the
            browser. Archiving hides a tag from pickers but keeps it on
            applications that already have it.
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <TagManager tags={tags} />
        </div>
      </div>
    </main>
  );
}
