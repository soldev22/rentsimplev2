import { notFound, redirect } from "next/navigation"

import PropertyFinancialsPageClient from "@/components/properties/PropertyFinancialsPageClient"
import { canManageProperties, isPendingApproval } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type PageContext = {
  params: Promise<{ id: string }>
}

export default async function PropertyFinancialsPage({ params }: PageContext) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")

  const { id } = await params
  const property = await getPropertyForUser(user, id)
  if (!property) notFound()

  return <PropertyFinancialsPageClient initialProperty={property} canManage={canManageProperties(user)} />
}