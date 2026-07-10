import Link from "next/link"
import { redirect } from "next/navigation"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForApplicantPage, listApplicationsForReviewPage, listApplicationsForTenant } from "@/lib/server/applications"
import { listPropertiesForUserPage, listPublicAvailableProperties } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"
import { listUsersForAdminPage } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type WorkflowStep = {
  title: string
  description: string
  state: "complete" | "active" | "next"
}

function getStepTone(step: WorkflowStep["state"]) {
  switch (step) {
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-900"
    case "active":
      return "border-sky-200 bg-sky-50 text-sky-900"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function getStepStateLabel(step: WorkflowStep["state"]) {
  if (step === "complete") {
    return "Complete"
  }

  if (step === "active") {
    return "In progress"
  }

  return "Next"
}

export default async function OnboardingDashboardPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const role = getUserRole(user)

  if (role === "applicant") {
    redirect("/dashboard/applicant")
  }

  if (role === "admin" || role === "agent" || role === "landlord") {
    const [reviewPage, propertyPage] = await Promise.all([
      listApplicationsForReviewPage(user, undefined, { page: 1, pageSize: 100 }),
      listPropertiesForUserPage(user, undefined, { page: 1, pageSize: 100 }),
    ])

    const reviewApplications = reviewPage.items
    const pendingDecisions = reviewApplications.filter((application) => application.approvalDecision.outcome === "pending").length
    const approvedInPipeline = reviewApplications.filter(
      (application) => application.status === "approved" || application.status === "approved_with_guarantor",
    ).length

    const pendingUsers =
      role === "admin"
        ? (await listUsersForAdminPage(user, { page: 1, pageSize: 100 })).items.filter(
            (candidate) => candidate.approval_status !== "approved",
          ).length
        : undefined

    const steps: WorkflowStep[] = [
      {
        title: "Approve incoming users",
        description:
          role === "admin"
            ? `${pendingUsers ?? 0} user${pendingUsers === 1 ? "" : "s"} currently waiting for approval or verification.`
            : "Admins approve new users and assign first active roles.",
        state: role === "admin" && (pendingUsers ?? 0) > 0 ? "active" : "next",
      },
      {
        title: "Publish and manage inventory",
        description: `${propertyPage.totalCount} propert${propertyPage.totalCount === 1 ? "y" : "ies"} in your accessible portfolio.`,
        state: propertyPage.totalCount > 0 ? "complete" : "active",
      },
      {
        title: "Review tenancy pipeline",
        description: `${pendingDecisions} pending decision${pendingDecisions === 1 ? "" : "s"} and ${approvedInPipeline} approved stage application${approvedInPipeline === 1 ? "" : "s"}.`,
        state: pendingDecisions > 0 ? "active" : "next",
      },
      {
        title: "Promote approved applicants to tenant",
        description: "Move approved applicants into tenant role once tenancy is granted and documentation is complete.",
        state: approvedInPipeline > 0 ? "active" : "next",
      },
    ]

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Onboarding</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Operator onboarding workflow</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            End-to-end workflow visibility for user approvals, property readiness, and tenancy progression.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {role === "admin" ? (
              <Link
                href="/dashboard/users"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open user approvals
              </Link>
            ) : null}
            <Link
              href="/dashboard/properties"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Open properties
            </Link>
            <Link
              href="/dashboard/applications"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Open applications
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {steps.map((step) => (
              <article key={step.title} className={`rounded-2xl border p-4 ${getStepTone(step.state)}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">{step.title}</h2>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {getStepStateLabel(step.state)}
                  </span>
                </div>
                <p className="mt-3 text-sm">{step.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    )
  }

  const tenantApplications = role === "tenant" ? await listApplicationsForTenant(user) : []
  const tenantDepositApplications = tenantApplications.filter((application) => application.depositRecord.requestedDate)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Onboarding</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Your onboarding workflow</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Keep moving through your next actions and stay aligned with your role-specific workspace.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">Role assigned</h2>
            <p className="mt-3 text-sm">Your access role is active and approved.</p>
          </article>
          <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">Next workspace</h2>
            <p className="mt-3 text-sm">
              Continue in {role === "tenant" || role === "builder" ? "maintenance" : "dashboard"} workflows.
            </p>
          </article>
        </div>

        {role === "tenant" ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">Deposit summary</h2>
                <p className="mt-2 text-sm text-slate-600">Track required deposit amounts, payment status, and protection details for your tenancy.</p>
              </div>
              <Link
                href="/dashboard/documents"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Open client documents
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {tenantDepositApplications.length > 0 ? (
                tenantDepositApplications.map((application) => (
                  <article key={application.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">{application.propertyAddress}</div>
                    <div className="mt-2 text-sm text-slate-600">Deposit required: £{application.depositRecord.amount.toLocaleString()}</div>
                    <div className="mt-1 text-sm text-slate-600">Status: {application.depositRecord.status.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Protection: {application.depositRecord.protectionProviderName
                        ? `${application.depositRecord.protectionProviderName} (${application.depositRecord.protectionReference || "Reference pending"})`
                        : "Awaiting protection details"}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 md:col-span-2">
                  No deposit requests have been recorded for your tenancy yet.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={role === "tenant" || role === "builder" ? "/dashboard/maintenance" : "/dashboard"}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Review settings
          </Link>
        </div>
      </section>
    </div>
  )
}
