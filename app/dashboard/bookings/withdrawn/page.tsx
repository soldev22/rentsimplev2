import Link from "next/link"
import { redirect } from "next/navigation"

import LandlordScopePicker from "@/components/dashboard/LandlordScopePicker"
import ApplicationReviewManager from "@/components/forms/ApplicationReviewManager"
import { canReviewTenancyApplications, getUserRole, isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntities } from "@/lib/server/audit"
import { listApplicationsForReviewPage } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type WithdrawnBookingsPageProps = {
  searchParams: Promise<{
    landlordId?: string
    page?: string
    pageSize?: string
  }>
}

function buildWithdrawnBookingsPageHref(input: { page: number; pageSize: number; landlordId?: string }) {
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
  return query ? `/dashboard/bookings/withdrawn?${query}` : "/dashboard/bookings/withdrawn"
}

function buildBookingsPageHref(input: { landlordId?: string }) {
  const params = new URLSearchParams()

  if (input.landlordId) {
    params.set("landlordId", input.landlordId)
  }

  const query = params.toString()
  return query ? `/dashboard/bookings?${query}` : "/dashboard/bookings"
}

export default async function WithdrawnBookingsPage({ searchParams }: WithdrawnBookingsPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) === "applicant") {
    redirect("/dashboard/applicant")
  }

  if (!canReviewTenancyApplications(user)) {
    redirect("/dashboard")
  }

  const role = getUserRole(user)
  const { landlordId, page: pageParam, pageSize: pageSizeParam } = await searchParams
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Math.floor(Number(pageParam))) : 1
  const pageSize = Number.isFinite(Number(pageSizeParam))
    ? Math.min(100, Math.max(10, Math.floor(Number(pageSizeParam))))
    : 25

  const [pagedApplications, landlords] = await Promise.all([
    listApplicationsForReviewPage(user, landlordId, { page, pageSize, statusFilter: "withdrawn" }),
    role === "admin" || role === "agent" ? listLandlordDirectoryForUser(user) : Promise.resolve([]),
  ])

  const auditEventsByApplicationId = await listAuditEventsForEntities(
    "application",
    pagedApplications.items.map((application) => application.id),
  )

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
            Showing {(pagedApplications.page - 1) * pagedApplications.pageSize + 1}-
            {Math.min(pagedApplications.page * pagedApplications.pageSize, pagedApplications.totalCount)} of {pagedApplications.totalCount} withdrawn applications.
          </span>
          <div className="flex items-center gap-3">
            <Link
              href={buildBookingsPageHref({ landlordId })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back to active applications
            </Link>
            <form method="get" className="flex items-center gap-2">
              {landlordId ? <input type="hidden" name="landlordId" value={landlordId} /> : null}
              <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Page size</label>
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                aria-label="Withdrawn applications page size"
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
              {pagedApplications.hasPreviousPage ? (
                <Link
                  href={buildWithdrawnBookingsPageHref({ page: pagedApplications.page - 1, pageSize, landlordId })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Previous</span>
              )}
              {pagedApplications.hasNextPage ? (
                <Link
                  href={buildWithdrawnBookingsPageHref({ page: pagedApplications.page + 1, pageSize, landlordId })}
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

      {pagedApplications.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No withdrawn applications found for this scope.
        </section>
      ) : (
        <ApplicationReviewManager
          initialApplications={pagedApplications.items}
          initialAuditEventsByApplicationId={Object.fromEntries(auditEventsByApplicationId)}
          currentUserDisplayName={`${user.first_name} ${user.last_name}`.trim() || user.email}
        />
      )}
    </div>
  )
}
