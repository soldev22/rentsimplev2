import { notFound, redirect } from "next/navigation"

import PropertyTenantAllocation from "@/components/properties/PropertyTenantAllocation"
import { canManageProperties, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function PropertyTenantAllocationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()

  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")
  if (!canManageProperties(user)) redirect("/dashboard")

  const { id } = await params
  const property = await getPropertyForUser(user, id)

  if (!property) notFound()

  const applications = (await listApplicationsForReview(user)).filter((application) => application.propertyId === property.id)

  return <PropertyTenantAllocation property={property} initialApplications={applications} />
}