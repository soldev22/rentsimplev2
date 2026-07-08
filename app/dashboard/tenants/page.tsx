import { redirect } from "next/navigation"

import LandlordScopePicker from "@/components/dashboard/LandlordScopePicker"
import TenantCommunicationThread from "@/components/forms/TenantCommunicationThread"
import { canReviewTenancyApplications, getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type TenantsPageProps = {
  searchParams: Promise<{
    landlordId?: string
  }>
}

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (!canReviewTenancyApplications(user)) {
    redirect("/dashboard")
  }

  const role = getUserRole(user)
  const { landlordId } = await searchParams
  const [applications, landlords] = await Promise.all([
    listApplicationsForReview(user, landlordId),
    role === "admin" || role === "agent" ? listLandlordDirectoryForUser(user) : Promise.resolve([]),
  ])

  const activeTenants = applications.filter((application) => application.status === "active_tenant")

  return (
    <div className="space-y-6">
      {role === "admin" || role === "agent" ? (
        <LandlordScopePicker
          landlords={landlords}
          selectedLandlordId={landlordId}
          allLabel={role === "admin" ? "All landlords" : "All managed landlords"}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Tenants</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Tenant portfolio</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review active occupiers attached to the selected landlord portfolio.
        </p>
      </section>

      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Current tenants</h2>
              <p className="mt-2 text-sm text-slate-600">Applications that have reached the active tenant stage.</p>
            </div>
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">{activeTenants.length}</div>
          </div>

          {activeTenants.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No active tenants are attached to this portfolio yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {activeTenants.map((application) => (
                <article key={application.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{application.applicantName}</div>
                  <div className="mt-1 text-sm text-slate-600">{application.applicantEmail}</div>
                  <div className="mt-2 text-sm text-slate-600">{application.propertyAddress}</div>
                  <div className="mt-3">
                    <TenantCommunicationThread
                      entries={application.postMoveInManagement.communicationEntries.slice(0, 3)}
                      title="Recent conversation"
                      description="Latest recorded contact with this tenant across calls, messages, and notes."
                      emptyMessage="No communications logged yet."
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
