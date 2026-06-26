import { redirect } from "next/navigation"

import ApplicantTenancyChecklist from "@/components/forms/ApplicantTenancyChecklist"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntity } from "@/lib/server/audit"
import { getApplicationForApplicant } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type ApplicantChecklistPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ApplicantChecklistPage({ params }: ApplicantChecklistPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) !== "applicant") {
    redirect("/dashboard")
  }

  const { id } = await params
  const application = await getApplicationForApplicant(user, id)

  if (!application) {
    redirect("/dashboard/applicant")
  }

  const auditEvents = await listAuditEventsForEntity("application", application.id)

  return <ApplicantTenancyChecklist initialApplication={application} initialAuditEvents={auditEvents} />
}