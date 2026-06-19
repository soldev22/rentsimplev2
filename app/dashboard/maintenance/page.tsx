import { redirect } from "next/navigation"

import MaintenanceHub from "@/components/forms/MaintenanceHub"
import { canAccessMaintenance, getUserRole, isPendingApproval } from "@/lib/auth"
import { listMaintenanceIssuesForUser, listReportableTenantProperties } from "@/lib/server/maintenance"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function MaintenancePage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (!canAccessMaintenance(user)) {
    redirect("/dashboard")
  }

  const role = getUserRole(user)
  const [issues, reportableProperties] = await Promise.all([
    listMaintenanceIssuesForUser(user),
    role === "tenant" ? listReportableTenantProperties(user) : Promise.resolve([]),
  ])

  return (
    <MaintenanceHub
      initialIssues={issues}
      reportableProperties={reportableProperties}
      role={role}
      currentUser={{
        id: user.id,
        email: user.email,
        displayName: user.first_name || user.last_name ? `${user.first_name} ${user.last_name}`.trim() : user.email,
        builderProfile: user.builderProfile,
      }}
    />
  )
}