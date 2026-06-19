import Link from "next/link"
import { redirect } from "next/navigation"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordDirectoryForUser } from "@/lib/server/users"

export const dynamic = "force-dynamic"

export default async function AgentDashboardPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) !== "agent") {
    redirect("/dashboard")
  }

  const [landlords, properties, applications] = await Promise.all([
    listLandlordDirectoryForUser(user),
    listPropertiesForUser(user),
    listApplicationsForReview(user),
  ])

  const propertyCountByLandlord = new Map<string, number>()
  const applicationCountByLandlord = new Map<string, number>()
  const propertyOwnerById = new Map(properties.map((property) => [property.id, property.ownerId]))

  for (const property of properties) {
    propertyCountByLandlord.set(property.ownerId, (propertyCountByLandlord.get(property.ownerId) ?? 0) + 1)
  }

  for (const application of applications) {
    const ownerId = propertyOwnerById.get(application.propertyId)

    if (!ownerId) {
      continue
    }

    applicationCountByLandlord.set(ownerId, (applicationCountByLandlord.get(ownerId) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Agent</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Managed landlords</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Choose a landlord portfolio to jump straight into the related properties, applicants, and tenant records.
        </p>
      </section>

      {landlords.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No landlords are assigned to this agent yet.
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {landlords.map((landlord) => (
            <article key={landlord.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{landlord.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{landlord.email}</p>
                </div>
                <div className="grid gap-2 text-right text-sm text-slate-600">
                  <div>{propertyCountByLandlord.get(landlord.id) ?? 0} properties</div>
                  <div>{applicationCountByLandlord.get(landlord.id) ?? 0} applications</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/dashboard/properties?landlordId=${landlord.id}`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  View properties
                </Link>
                <Link href={`/dashboard/bookings?landlordId=${landlord.id}`} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                  View applicants
                </Link>
                <Link href={`/dashboard/tenants?landlordId=${landlord.id}`} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                  View tenants
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}