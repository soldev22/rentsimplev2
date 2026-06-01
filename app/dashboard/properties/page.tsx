import { redirect } from "next/navigation"

import PropertyManager from "@/components/properties/PropertyManager"
import { canManageProperties, getUserRole, isPendingApproval } from "@/lib/auth"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function PropertiesPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const properties = await listPropertiesForUser(user)

  return (
    <PropertyManager
      initialProperties={properties}
      canManage={canManageProperties(user)}
      isAdmin={getUserRole(user) === "admin"}
    />
  )
}
