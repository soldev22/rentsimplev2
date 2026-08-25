import { notFound, redirect } from "next/navigation"

import PropertyLettingPreferencesPageClient from "@/components/properties/PropertyLettingPreferencesPageClient"
import { canManageProperties, isPendingApproval } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function PropertyLettingPreferencesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")
  const { id } = await params
  const property = await getPropertyForUser(user, id)
  if (!property) notFound()
  return <PropertyLettingPreferencesPageClient initialProperty={property} canManage={canManageProperties(user)} />
}