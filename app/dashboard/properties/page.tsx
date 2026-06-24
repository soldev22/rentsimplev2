import Link from "next/link"
import { redirect } from "next/navigation"

import LandlordScopePicker from "@/components/dashboard/LandlordScopePicker"
import PropertyManager from "@/components/properties/PropertyManager"
import { canManageProperties, getUserRole, isPendingApproval } from "@/lib/auth"
import { listPropertiesForUserPage } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type PropertiesPageProps = {
  searchParams: Promise<{
    landlordId?: string
    page?: string
    pageSize?: string
  }>
}

function buildPropertiesPageHref(input: { page: number; pageSize: number; landlordId?: string }) {
  const params = new URLSearchParams()

  if (input.page > 1) {
    params.set("page", String(input.page))
  }

  if (input.pageSize !== 25) {
    params.set("pageSize", String(input.pageSize))
  }

  if (input.landlordId) {
    params.set("landlordId", input.landlordId)
  }

  const query = params.toString()
  return query ? `/dashboard/properties?${query}` : "/dashboard/properties"
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const role = getUserRole(user)
  const { landlordId, page: pageParam, pageSize: pageSizeParam } = await searchParams
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Math.floor(Number(pageParam))) : 1
  const pageSize = Number.isFinite(Number(pageSizeParam))
    ? Math.min(100, Math.max(10, Math.floor(Number(pageSizeParam))))
    : 25
  const [pagedProperties, landlords] = await Promise.all([
    listPropertiesForUserPage(user, landlordId, { page, pageSize }),
    role === "admin" || role === "agent" ? listLandlordDirectoryForUser(user) : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      {role === "admin" || role === "agent" ? (
        <LandlordScopePicker
          landlords={landlords}
          selectedLandlordId={landlordId}
          allLabel={role === "admin" ? "All landlords" : "All managed landlords"}
        />
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Showing {(pagedProperties.page - 1) * pagedProperties.pageSize + 1}-
            {Math.min(pagedProperties.page * pagedProperties.pageSize, pagedProperties.totalCount)} of {pagedProperties.totalCount} properties.
          </span>
          <div className="flex items-center gap-3">
            <form method="get" className="flex items-center gap-2">
              {landlordId ? <input type="hidden" name="landlordId" value={landlordId} /> : null}
              <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Page size</label>
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                aria-label="Properties page size"
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
            {pagedProperties.hasPreviousPage ? (
              <Link
                href={buildPropertiesPageHref({ page: pagedProperties.page - 1, pageSize, landlordId })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Previous</span>
            )}
            {pagedProperties.hasNextPage ? (
              <Link
                href={buildPropertiesPageHref({ page: pagedProperties.page + 1, pageSize, landlordId })}
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
      <PropertyManager
        initialProperties={pagedProperties.items}
        canManage={canManageProperties(user)}
        isAdmin={role === "admin"}
        landlordOptions={landlords}
        canAssignOwner={role === "admin" || role === "agent"}
        defaultOwnerId={landlordId ?? landlords[0]?.id ?? user.id}
      />
    </div>
  )
}
