import Link from "next/link"
import { redirect } from "next/navigation"

import LandlordScopePicker from "@/components/dashboard/LandlordScopePicker"
import { canReviewTenancyApplications, getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForApplicant, listApplicationsForReview, listApplicationsForReviewPage, listApplicationsForTenant } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type DocumentsPageProps = {
  searchParams: Promise<{
    landlordId?: string
    applicationId?: string
    page?: string
    pageSize?: string
  }>
}

function buildDocumentsPageHref(input: { page: number; pageSize: number; landlordId?: string }) {
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
  return query ? `/dashboard/documents?${query}` : "/dashboard/documents"
}

function formatDate(value?: string) {
  if (!value) {
    return "Not recorded"
  }

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Date(parsed).toLocaleString("en-GB")
}

export default async function Page({ searchParams }: DocumentsPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const role = getUserRole(user)
  const isReviewer = canReviewTenancyApplications(user)
  const isClientSelfService = role === "applicant" || role === "tenant"

  if (!isReviewer && !isClientSelfService) {
    redirect("/dashboard")
  }

  const { landlordId, applicationId, page: pageParam, pageSize: pageSizeParam } = await searchParams
  const applicationIdFilter = applicationId?.trim() || undefined
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

  const allApplications = isReviewer
    ? await listApplicationsForReview(user, effectiveLandlordId)
    : role === "tenant"
      ? await listApplicationsForTenant(user)
      : await listApplicationsForApplicant(user)

  const pagedApplications = isReviewer
    ? applicationIdFilter
      ? {
          page: 1,
          pageSize: 1,
          totalCount: 0,
          hasPreviousPage: false,
          hasNextPage: false,
          items: allApplications.filter((application) => application.id === applicationIdFilter),
        }
      : await listApplicationsForReviewPage(user, effectiveLandlordId, {
          page,
          pageSize,
          statusFilter: "non_withdrawn",
        })
    : {
        page: 1,
        pageSize: allApplications.length,
        totalCount: allApplications.length,
        hasPreviousPage: false,
        hasNextPage: false,
        items: applicationIdFilter
          ? allApplications.filter((application) => application.id === applicationIdFilter)
          : allApplications,
      }

  const totalDocuments = pagedApplications.items.reduce((count, application) => {
    const verificationCount = application.referencingInstruction.verificationDocuments.length
    const tenancyCount = [
      application.tenancyAgreement.offerLetter.url,
      application.tenancyAgreement.leaseDocument.url,
      application.tenancyAgreement.supportingLegalDocuments.url,
    ].filter(Boolean).length

    const guarantorCount = (application.referencingInstruction.referenceRequests ?? []).filter(
      (request) => request.status === "completed" || request.status === "declined",
    ).length

    return count + verificationCount + tenancyCount + guarantorCount
  }, 0)

  return (
    <div className="space-y-6">
      {role === "admin" || role === "agent" ? (
        <LandlordScopePicker
          landlords={landlords}
          selectedLandlordId={effectiveLandlordId}
          allLabel={role === "admin" ? "All landlords" : "All managed landlords"}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Client documents</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Client document vault</h1>
            <p className="mt-2 text-sm text-slate-600">
              A single area for uploaded verification files, tenancy paperwork, and guarantor declaration copies.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Documents listed</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{totalDocuments}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          {applicationIdFilter ? (
            <span>
              Showing documents for application {applicationIdFilter}.
            </span>
          ) : (
            <span>
              Showing {(pagedApplications.page - 1) * pagedApplications.pageSize + 1}-
              {Math.min(pagedApplications.page * pagedApplications.pageSize, pagedApplications.totalCount)} of {pagedApplications.totalCount} applications.
            </span>
          )}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/applications"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back to applications
            </Link>
            {isReviewer && !applicationIdFilter ? (
              <>
                <form method="get" className="flex items-center gap-2">
                  {effectiveLandlordId ? <input type="hidden" name="landlordId" value={effectiveLandlordId} /> : null}
                  <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Page size</label>
                  <select
                    name="pageSize"
                    defaultValue={String(pageSize)}
                    aria-label="Document vault page size"
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
                      href={buildDocumentsPageHref({ page: pagedApplications.page - 1, pageSize, landlordId: effectiveLandlordId })}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Previous</span>
                  )}
                  {pagedApplications.hasNextPage ? (
                    <Link
                      href={buildDocumentsPageHref({ page: pagedApplications.page + 1, pageSize, landlordId: effectiveLandlordId })}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">Next</span>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {pagedApplications.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No client documents were found for the selected scope.
        </section>
      ) : (
        pagedApplications.items.map((application) => {
          const refereesById = new Map((application.referencingInstruction.referees ?? []).map((referee) => [referee.id, referee]))
          const completedOrDeclinedRequests = (application.referencingInstruction.referenceRequests ?? []).filter(
            (request) => request.status === "completed" || request.status === "declined",
          )

          return (
            <section key={application.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">{application.applicantName}</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{application.propertyAddress}</h2>
                  <p className="mt-2 text-sm text-slate-600">{application.applicantEmail}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Verification uploads</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {application.referencingInstruction.verificationDocuments.length > 0 ? (
                      application.referencingInstruction.verificationDocuments.map((document) => (
                        <li key={document.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                          <div className="font-medium text-slate-900">{document.fileName}</div>
                          <div className="mt-1 text-xs text-slate-600">Uploaded {formatDate(document.uploadedAt)} by {document.uploadedByEmail}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <a
                              className="font-semibold text-cyan-800 underline"
                              href={`/api/applications/${application.id}/verification-documents/${document.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                            <a
                              className="font-semibold text-cyan-800 underline"
                              href={`/api/applications/${application.id}/verification-documents/${document.id}?download=1`}
                            >
                              Download
                            </a>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">No verification uploads yet.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Tenancy documents</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {application.tenancyAgreement.offerLetter.url ? (
                      <li>
                        <a
                          className="font-semibold text-cyan-800 underline"
                          href={application.tenancyAgreement.offerLetter.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Offer letter
                        </a>
                      </li>
                    ) : null}
                    {application.tenancyAgreement.leaseDocument.url ? (
                      <li>
                        <a
                          className="font-semibold text-cyan-800 underline"
                          href={application.tenancyAgreement.leaseDocument.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lease copy
                        </a>
                      </li>
                    ) : null}
                    {application.tenancyAgreement.supportingLegalDocuments.url ? (
                      <li>
                        <a
                          className="font-semibold text-cyan-800 underline"
                          href={application.tenancyAgreement.supportingLegalDocuments.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Supporting legal pack
                        </a>
                      </li>
                    ) : null}
                    {!application.tenancyAgreement.offerLetter.url &&
                    !application.tenancyAgreement.leaseDocument.url &&
                    !application.tenancyAgreement.supportingLegalDocuments.url ? (
                      <li className="text-slate-500">No tenancy document links recorded yet.</li>
                    ) : null}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Guarantor declarations</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {completedOrDeclinedRequests.length > 0 ? (
                      completedOrDeclinedRequests.map((request) => {
                        const referee = refereesById.get(request.refereeId)
                        return (
                          <li key={request.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <div className="font-medium text-slate-900">{referee?.fullName || "Guarantor"}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {request.status.replaceAll("_", " ")} on {formatDate(request.respondedAt)}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                              <a
                                className="font-semibold text-cyan-800 underline"
                                href={`/api/applications/${application.id}/guarantor-reference-requests/${request.id}/consent-document`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View declaration
                              </a>
                              <a
                                className="font-semibold text-cyan-800 underline"
                                href={`/api/applications/${application.id}/guarantor-reference-requests/${request.id}/consent-document?format=pdf`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View PDF
                              </a>
                              <a
                                className="font-semibold text-cyan-800 underline"
                                href={`/api/applications/${application.id}/guarantor-reference-requests/${request.id}/consent-document?format=pdf&download=1`}
                              >
                                Download PDF
                              </a>
                            </div>
                          </li>
                        )
                      })
                    ) : (
                      <li className="text-slate-500">No guarantor declaration responses recorded yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
