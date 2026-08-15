import Link from "next/link"
import { redirect } from "next/navigation"

import { isPendingApproval, type ComplianceType } from "@/lib/auth"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

const complianceLabels: Record<ComplianceType, string> = {
  electrical: "Electrical Installation (EICR)",
  gas: "Gas Safety Certificate and Carbon Monoxide Alarms",
  fire_alarm: "Fire Alarm",
  smoke_alarm: "Smoke and Heat Alarm Testing",
  legionella: "Legionella Control",
  epc: "Energy Performance Certificate (EPC)",
  damp_survey: "Damp Survey",
  asbestos_survey: "Asbestos Survey",
  pest_control: "Pest Control",
  boiler_service: "Boiler Service",
  pat_testing: "PAT Testing",
}

type ComplianceWorkItem = {
  propertyId: string
  propertyAddress: string
  label: string
  dueDate: string
  daysUntilDue: number
}

function getStatus(daysUntilDue: number) {
  if (daysUntilDue < 0) return { label: "Overdue", className: "border-red-300 bg-red-100 text-red-900" }
  if (daysUntilDue <= 30) return { label: "Due within 30 days", className: "border-red-300 bg-red-100 text-red-900" }
  return { label: "Due in 31-90 days", className: "border-amber-300 bg-amber-100 text-amber-900" }
}

export default async function ComplianceWorklistPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const properties = await listPropertiesForUser(user)
  const workItems: ComplianceWorkItem[] = []

  for (const property of properties) {
    for (const compliance of property.compliance ?? []) {
      if (compliance.notApplicable || !compliance.expirationDate) continue

      const patItem = compliance.type === "pat_testing"
        ? property.includedItems?.find((item) => item.id === compliance.patItemId && item.isElectrical)
        : undefined
      if (compliance.type === "pat_testing" && !patItem) continue

      const dueDate = new Date(`${compliance.expirationDate}T00:00:00`)
      if (Number.isNaN(dueDate.getTime())) continue
      const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue > 90) continue

      workItems.push({
        propertyId: property.id,
        propertyAddress: property.address,
        label: patItem ? `PAT Testing: ${patItem.name}` : complianceLabels[compliance.type],
        dueDate: compliance.expirationDate,
        daysUntilDue,
      })
    }
  }

  workItems.sort((left, right) => left.daysUntilDue - right.daysUntilDue || left.propertyAddress.localeCompare(right.propertyAddress))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Portfolio</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Compliance worklist</h1>
          <p className="mt-2 text-sm text-slate-600">Overdue requirements and certificates due in the next 90 days.</p>
        </div>
        <Link href="/dashboard/landlord" className="text-sm font-medium text-sky-700 hover:underline">Back to dashboard</Link>
      </div>

      {workItems.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">No overdue or upcoming compliance requirements.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[1.4fr_1.2fr_1fr_auto] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            <div>Property</div><div>Requirement</div><div>Due</div><div>Status</div>
          </div>
          {workItems.map((item) => {
            const status = getStatus(item.daysUntilDue)
            return (
              <Link key={`${item.propertyId}-${item.label}-${item.dueDate}`} href={`/dashboard/properties/${item.propertyId}/compliance`} className="grid grid-cols-[1.4fr_1.2fr_1fr_auto] items-center gap-3 border-b border-slate-100 px-4 py-4 text-sm hover:bg-slate-50 last:border-b-0">
                <span className="font-semibold text-slate-900">{item.propertyAddress}</span>
                <span className="text-slate-700">{item.label}</span>
                <span className="text-slate-700">{new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-GB")}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}