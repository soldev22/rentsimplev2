import { redirect } from "next/navigation"

import LandlordScopePicker from "@/components/dashboard/LandlordScopePicker"
import PropertyManager from "@/components/properties/PropertyManager"
import { canManageProperties, getUserRole, isPendingApproval } from "@/lib/auth"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type PropertiesPageProps = {
  searchParams: Promise<{
    landlordId?: string
  }>
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const role = getUserRole(user)
  const { landlordId } = await searchParams
  const [properties, landlords] = await Promise.all([
    listPropertiesForUser(user, landlordId),
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
      <PropertyManager
        initialProperties={properties}
        canManage={canManageProperties(user)}
        isAdmin={role === "admin"}
        landlordOptions={landlords}
        canAssignOwner={role === "admin" || role === "agent"}
        defaultOwnerId={landlordId ?? landlords[0]?.id ?? user.id}
      />
    </div>
  )
}
