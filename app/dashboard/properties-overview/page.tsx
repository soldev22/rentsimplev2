import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server/session"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getCasesByProperty } from "@/lib/server/cases"
import PropertyHealthDashboardServer from "@/components/dashboard/PropertyHealthDashboardServer"

export const metadata = {
  title: "Properties Overview | RentSimple",
}

export default async function PropertiesOverviewPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  const properties = await listPropertiesForUser(user)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Properties Overview</h1>
        <p className="text-gray-600 mt-2">View health and status across your entire portfolio</p>
      </div>

      {/* Properties Grid */}
      {properties.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No properties found. Add a property to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {properties.map((property) => (
            <PropertyHealthDashboardServer
              key={property.id}
              property={property}
            />
          ))}
        </div>
      )}
    </div>
  )
}
