import { redirect } from "next/navigation"

import ApplicationReviewManager from "@/components/forms/ApplicationReviewManager"
import { canReviewTenancyApplications, getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function Page() {
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

  const applications = await listApplicationsForReview(user)

  return <ApplicationReviewManager initialApplications={applications} />
}
