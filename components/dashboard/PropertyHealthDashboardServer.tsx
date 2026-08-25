import type { PropertyRecord } from "@/lib/auth"
import { getCasesByProperty } from "@/lib/server/cases"
import PropertyHealthDashboard from "@/components/dashboard/PropertyHealthDashboard"

const standardComplianceTypes = ["electrical", "gas", "fire_alarm", "smoke_alarm", "legionella", "epc", "damp_survey", "asbestos_survey", "pest_control", "boiler_service"] as const

type PropertyHealthDashboardServerProps = {
  property: PropertyRecord
}

export default async function PropertyHealthDashboardServer({ property }: PropertyHealthDashboardServerProps) {
  const cases = await getCasesByProperty(property.id)

  // Calculate compliance status
  const compliance = property.compliance || []
  const now = new Date()
  const missingCompliance = standardComplianceTypes.some((type) => {
    const record = compliance.find((item) => item.type === type)
    return !record || (!record.notApplicable && !record.expirationDate)
  })
  const expiredCompliance = compliance.filter((c) => !c.notApplicable && c.expirationDate && new Date(c.expirationDate) < now)
  const expiringSoonCompliance = compliance.filter(
    (c) =>
      !c.notApplicable && c.expirationDate &&
      new Date(c.expirationDate) > now &&
      (new Date(c.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) < 30,
  )

  let complianceStatus: "green" | "amber" | "red" = "green"
  if (missingCompliance || expiredCompliance.length > 0) {
    complianceStatus = "red"
  } else if (expiringSoonCompliance.length > 0) {
    complianceStatus = "amber"
  }

  // Placeholder values for now
  const unreadMessageCount = 0
  const averageResponseTimeHours = 24

  return (
    <PropertyHealthDashboard
      property={property}
      cases={cases}
      unreadMessageCount={unreadMessageCount}
      averageResponseTimeHours={averageResponseTimeHours}
      complianceStatus={complianceStatus}
      onClick={() => {
        // Navigate to property detail
      }}
    />
  )
}
