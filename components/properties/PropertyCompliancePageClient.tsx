"use client"

import Link from "next/link"
import { useState } from "react"

import PropertyCompliancePanel from "@/components/properties/PropertyCompliancePanel"
import type { PropertyRecord } from "@/lib/auth"

type PropertyCompliancePageClientProps = {
  initialProperty: PropertyRecord
  canManage: boolean
}

export default function PropertyCompliancePageClient({ initialProperty, canManage }: PropertyCompliancePageClientProps) {
  const [property, setProperty] = useState(initialProperty)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Property</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{property.address}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {property.type} · {property.status} · {property.postcode}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/properties/${property.id}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Property details
          </Link>
          <Link
            href={`/dashboard/properties/${property.id}/compliance`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Compliance
          </Link>
        </div>
      </div>

      <PropertyCompliancePanel property={property} canManage={canManage} onPropertyUpdate={setProperty} />
    </div>
  )
}
