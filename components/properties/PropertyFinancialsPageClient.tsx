"use client"

import { useState } from "react"

import PropertyFinancialsPanel from "@/components/properties/PropertyFinancialsPanel"
import PropertyTabs from "@/components/properties/PropertyTabs"
import type { PropertyRecord } from "@/lib/auth"

type PropertyFinancialsPageClientProps = {
  initialProperty: PropertyRecord
  canManage: boolean
}

export default function PropertyFinancialsPageClient({ initialProperty, canManage }: PropertyFinancialsPageClientProps) {
  const [property, setProperty] = useState(initialProperty)

  return (
    <div className="space-y-6">
      <div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Property</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{property.address}</h1>
          <p className="mt-2 text-sm text-slate-600">{property.type} · {property.status} · £{property.monthlyRent.toLocaleString()}/month</p>
        </div>

      </div>

      <PropertyTabs propertyId={property.id} />

      <PropertyFinancialsPanel property={property} canManage={canManage} onPropertyUpdate={setProperty} />
    </div>
  )
}