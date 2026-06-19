// app/dashboard/applicant/page.tsx
import { redirect } from "next/navigation"

import ApplicantTenancyWorkflow from "@/components/forms/ApplicantTenancyWorkflow"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForApplicant } from "@/lib/server/applications"
import { listPublicAvailableProperties } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type ApplicantDashboardProps = {
  searchParams: Promise<{
    propertyId?: string
  }>
}

export default async function ApplicantDashboard({ searchParams }: ApplicantDashboardProps) {
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

  const { propertyId } = await searchParams
  const [availableProperties, applications] = await Promise.all([
    listPublicAvailableProperties(),
    listApplicationsForApplicant(user),
  ])

  return (
    <ApplicantTenancyWorkflow
      availableProperties={availableProperties}
      initialApplications={applications}
      initialApplicantProfile={user.applicantProfile}
      preselectedPropertyId={propertyId}
    />
  )
}