import { redirect } from "next/navigation"

import LandlordProfileSettingsForm from "@/components/forms/LandlordProfileSettingsForm"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordTeamUsers } from "@/lib/server/users"

export const dynamic = "force-dynamic"

export default async function LandlordProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")
  if (getUserRole(user) !== "landlord") redirect("/dashboard")

  const teamUsers = await listLandlordTeamUsers(user)
  return (
    <LandlordProfileSettingsForm
      initialProfile={{
        firstName: user.first_name,
        lastName: user.last_name,
        mobile: user.mobile,
        email: user.email,
        landlordProfile: user.landlordProfile,
        notificationProfile: user.notificationProfile,
        screeningScoreConfig: user.screeningScoreConfig,
      }}
      initialTeamUsers={teamUsers}
    />
  )
}