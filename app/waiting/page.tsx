import { getUserRole, isPendingVerification } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import WaitingClient from "./waiting-client"

type WaitingStageState = "complete" | "active" | "next"
type WaitingStageItem = {
  title: string
  description: string
  state: WaitingStageState
}

export default async function WaitingPage() {
  const user = await getSessionUser()
  const role = getUserRole(user)
  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || "User" : "User"
  const awaitingVerification = isPendingVerification(user)
  const stageItems: WaitingStageItem[] = awaitingVerification
    ? [
        {
          title: "Account created",
          description: "Your account record has been created.",
          state: "complete",
        },
        {
          title: "Verify email",
          description: "Check your inbox and click the verification link.",
          state: "active",
        },
        {
          title: "Await role allocation",
          description: "An administrator will assign your active role after verification.",
          state: "next",
        },
      ]
    : [
        {
          title: "Account created",
          description: "Your account record has been created.",
          state: "complete",
        },
        {
          title: "In approval queue",
          description: "An administrator will assign your active role shortly.",
          state: "active",
        },
        {
          title: "Start dashboard workflow",
          description: "You will be redirected to your role-specific dashboard when approved.",
          state: "next",
        },
      ]

  return (
    <WaitingClient
      displayName={displayName}
      role={role}
      awaitingVerification={awaitingVerification}
      stageItems={stageItems}
    />
  )
}

