import Link from "next/link";
import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { Brand } from "@/components/brand";
import { RoleSelect } from "@/components/role-select";
import { db } from "@/lib/db";
import { account, application, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Users — Admin" };

export default async function AdminUsersPage() {
  const { user: me } = await requireAdmin();

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      providers: sql<string[]>`coalesce(array_agg(distinct ${account.providerId}) filter (where ${account.providerId} is not null), '{}')`,
      submittedAt: sql<string | null>`max(${application.submittedAt}::text)`,
      hasDraft: sql<boolean>`count(${application.id}) > 0`,
    })
    .from(user)
    .leftJoin(account, sql`${account.userId} = ${user.id}`)
    .leftJoin(application, sql`${application.userId} = ${user.id}`)
    .groupBy(user.id)
    .orderBy(asc(user.createdAt));

  const adminCount = rows.filter((r) => r.role === "admin").length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Brand suffix="/ USERS" />
        <Link href="/admin" className="btn-ghost !py-2 text-[14px]">
          ← Admin
        </Link>
      </header>

      <div className="flex flex-col gap-6 pb-20 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-[14px] text-muted">
            {rows.length} account{rows.length === 1 ? "" : "s"} · {adminCount}{" "}
            admin{adminCount === 1 ? "" : "s"}. Role changes apply on the
            user&apos;s next request, no re-login needed. You cannot change
            your own role.
          </p>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-160 text-[14px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  User
                </th>
                <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  Sign-in
                </th>
                <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  Application
                </th>
                <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  Joined
                </th>
                <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-moonlit/95">
                      {u.name || "(no name)"}
                    </p>
                    <p className="font-mono text-[12.5px] text-faint">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {u.providers.length > 0
                      ? u.providers
                          .map((p) => (p === "credential" ? "email" : p))
                          .join(", ")
                      : "none"}
                  </td>
                  <td className="px-4 py-3 text-[13.5px]">
                    {u.submittedAt ? (
                      <span className="text-ok">submitted</span>
                    ) : u.hasDraft ? (
                      <span className="text-muted">draft</span>
                    ) : (
                      <span className="text-faint">none</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {u.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "America/Los_Angeles",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <RoleSelect
                      userId={u.id}
                      initialRole={u.role ?? "applicant"}
                      isSelf={u.id === me.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
