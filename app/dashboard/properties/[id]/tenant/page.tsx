import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import PropertyTenantPanel from "@/components/properties/PropertyTenantPanel"
import PropertyTabs from "@/components/properties/PropertyTabs"
import { canReviewTenancyApplications, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type PropertyTenantPageProps = {
  params: Promise<{ id: string }>
}

export default async function PropertyTenantPage({ params }: PropertyTenantPageProps) {
  const user = await getSessionUser()

  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")
  if (!canReviewTenancyApplications(user)) redirect("/dashboard")

  const { id } = await params
  const property = await getPropertyForUser(user, id)
  if (!property) notFound()

  const activeTenancies = (await listApplicationsForReview(user)).filter(
    (application) => application.propertyId === property.id && application.status === "active_tenant",
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Property</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{property.address}</h1>
        </div>
        <Link href={`/dashboard/properties/${property.id}`} className="text-sm font-medium text-sky-700 hover:underline">Back to property</Link>
      </div>

      <PropertyTabs propertyId={property.id} showTenantTab />
      <PropertyTenantPanel activeTenancies={activeTenancies} />
    </div>
  )
}