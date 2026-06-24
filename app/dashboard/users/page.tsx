import Link from "next/link"
import { redirect } from "next/navigation"

import AdminUserManager from "@/components/forms/AdminUserManager"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { listAgentsForAdmin, listUsersForAdminPage } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type UsersPageProps = {
  searchParams: Promise<{
    page?: string
    pageSize?: string
  }>
}

function buildUsersPageHref(page: number, pageSize: number) {
  const params = new URLSearchParams()

  if (page > 1) {
    params.set("page", String(page))
  }

  if (pageSize !== 25) {
    params.set("pageSize", String(pageSize))
  }

  const query = params.toString()
  return query ? `/dashboard/users?${query}` : "/dashboard/users"
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) !== "admin") {
    redirect("/dashboard")
  }

  const { page: pageParam, pageSize: pageSizeParam } = await searchParams
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Math.floor(Number(pageParam))) : 1
  const pageSize = Number.isFinite(Number(pageSizeParam))
    ? Math.min(100, Math.max(10, Math.floor(Number(pageSizeParam))))
    : 25
  const [pagedUsers, agents] = await Promise.all([listUsersForAdminPage(user, { page, pageSize }), listAgentsForAdmin(user)])

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Showing {(pagedUsers.page - 1) * pagedUsers.pageSize + 1}-
            {Math.min(pagedUsers.page * pagedUsers.pageSize, pagedUsers.totalCount)} of {pagedUsers.totalCount} users.
          </span>
          <div className="flex items-center gap-3">
            <form method="get" className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Page size</label>
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                aria-label="Users page size"
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
              >
                {[10, 25, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Apply
              </button>
            </form>
            <div className="flex items-center gap-2">
            {pagedUsers.hasPreviousPage ? (
              <Link
                href={buildUsersPageHref(pagedUsers.page - 1, pageSize)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Previous</span>
            )}
            {pagedUsers.hasNextPage ? (
              <Link
                href={buildUsersPageHref(pagedUsers.page + 1, pageSize)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Next</span>
            )}
            </div>
          </div>
        </div>
      </section>
      <AdminUserManager initialUsers={pagedUsers.items} initialAgents={agents} currentUserEmail={user.email} />
    </div>
  )
}