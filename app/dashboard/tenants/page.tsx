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
  const applicantPipeline = applications.filter((application) => application.status !== "active_tenant")

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
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Tenants and applicant pipeline</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review the occupiers and applicants attached to the selected landlord portfolio.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Applicant pipeline</h2>
              <p className="mt-2 text-sm text-slate-600">Applicants still progressing through screening, agreement, and move-in stages.</p>
            </div>
            <div className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900">{applicantPipeline.length}</div>
          </div>

          {applicantPipeline.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No applicants are currently in this landlord portfolio.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {applicantPipeline.map((application) => (
                <article key={application.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{application.applicantName}</div>
                  <div className="mt-1 text-sm text-slate-600">{application.applicantEmail}</div>
                  <div className="mt-2 text-sm text-slate-600">{application.propertyAddress}</div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{application.status.replaceAll("_", " ")}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    Communications logged: {application.postMoveInManagement.communicationEntries.length}
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
