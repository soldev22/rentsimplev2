import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import PropertyCompliancePageClient from "@/components/properties/PropertyCompliancePageClient"
import { canManageProperties, canReviewTenancyApplications, isPendingApproval } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type PageContext = {
  params: Promise<{
    id: string
  }>
}

export default async function PropertyCompliancePage({ params }: PageContext) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const { id } = await params
  const property = await getPropertyForUser(user, id)

  if (!property) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Compliance</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Property compliance</h1>
        </div>
        <Link href="/dashboard/properties" className="text-sm font-medium text-sky-700 hover:underline">
          Back to properties
        </Link>
      </div>

      <PropertyCompliancePageClient
        initialProperty={property}
        canManage={canManageProperties(user)}
        canViewTenant={canReviewTenancyApplications(user)}
      />
    </div>
  )
}
