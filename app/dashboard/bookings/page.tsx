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

type BookingsPageProps = {
  searchParams: Promise<{
    landlordId?: string
    page?: string
    pageSize?: string
  }>
}

function buildBookingsPageHref(input: { page: number; pageSize: number; landlordId?: string }) {
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
  return query ? `/dashboard/applications?${query}` : "/dashboard/applications"
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
  return query ? `/dashboard/applications/withdrawn?${query}` : "/dashboard/applications/withdrawn"
}

export default async function Page({ searchParams }: BookingsPageProps) {
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
  const landlords = role === "admin" || role === "agent" ? await listLandlordDirectoryForUser(user) : []
  const effectiveLandlordId =
    role === "admin" || role === "agent"
      ? landlordId && landlords.some((landlord) => landlord.id === landlordId)
        ? landlordId
        : undefined
      : undefined
  const pagedApplications = await listApplicationsForReviewPage(user, effectiveLandlordId, {
    page,
    pageSize,
    statusFilter: "non_withdrawn",
  })
  const auditEventsByApplicationId = await listAuditEventsForEntities(
    "application",
    pagedApplications.items.map((application) => application.id),
  )

  return (
    <div className="space-y-6">
      {role === "admin" || role === "agent" ? (
        <LandlordScopePicker
          landlords={landlords}
          selectedLandlordId={effectiveLandlordId}
          allLabel={role === "admin" ? "All landlords" : "All managed landlords"}
        />
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Showing {(pagedApplications.page - 1) * pagedApplications.pageSize + 1}-
            {Math.min(pagedApplications.page * pagedApplications.pageSize, pagedApplications.totalCount)} of {pagedApplications.totalCount} applications.
          </span>
          <div className="flex items-center gap-3">
            <Link
              href={effectiveLandlordId ? `/dashboard/documents?landlordId=${encodeURIComponent(effectiveLandlordId)}` : "/dashboard/documents"}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Client documents
            </Link>
            <Link
              href={buildWithdrawnBookingsPageHref({ page: 1, pageSize, landlordId: effectiveLandlordId })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              View withdrawn applications
            </Link>
            <form method="get" className="flex items-center gap-2">
              {effectiveLandlordId ? <input type="hidden" name="landlordId" value={effectiveLandlordId} /> : null}
              <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Page size</label>
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                aria-label="Applications page size"
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
                href={buildBookingsPageHref({ page: pagedApplications.page - 1, pageSize, landlordId: effectiveLandlordId })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Previous</span>
            )}
            {pagedApplications.hasNextPage ? (
              <Link
                href={buildBookingsPageHref({ page: pagedApplications.page + 1, pageSize, landlordId: effectiveLandlordId })}
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
      <ApplicationReviewManager
        initialApplications={pagedApplications.items}
        initialAuditEventsByApplicationId={Object.fromEntries(auditEventsByApplicationId)}
        currentUserDisplayName={`${user.first_name} ${user.last_name}`.trim() || user.email}
        isAdmin={role === "admin"}
        screeningScoreConfig={user.screeningScoreConfig}
        canRequestCreditReport={role === "landlord"}
      />
    </div>
  )
}
