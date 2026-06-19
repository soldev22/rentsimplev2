import { redirect } from "next/navigation"

import LandlordScopePicker from "@/components/dashboard/LandlordScopePicker"
import ApplicationReviewManager from "@/components/forms/ApplicationReviewManager"
import { canReviewTenancyApplications, getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type BookingsPageProps = {
  searchParams: Promise<{
    landlordId?: string
  }>
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
  const { landlordId } = await searchParams
  const [applications, landlords] = await Promise.all([
    listApplicationsForReview(user, landlordId),
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
      <ApplicationReviewManager
        initialApplications={applications}
        currentUserDisplayName={`${user.first_name} ${user.last_name}`.trim() || user.email}
      />
    </div>
  )
}
