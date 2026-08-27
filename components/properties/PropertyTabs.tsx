"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type PropertyTabsProps = {
  propertyId: string
  showTenantTab?: boolean
}

export default function PropertyTabs({ propertyId, showTenantTab = false }: PropertyTabsProps) {
  const pathname = usePathname()
  const tabs = [
    { label: "Property details", href: `/dashboard/properties/${propertyId}` },
    { label: "Compliance", href: `/dashboard/properties/${propertyId}/compliance` },
    { label: "Financials", href: `/dashboard/properties/${propertyId}/financials` },
    { label: "Letting preferences", href: `/dashboard/properties/${propertyId}/letting-preferences` },
    ...(showTenantTab ? [{ label: "Tenant", href: `/dashboard/properties/${propertyId}/tenant` }] : []),
  ]

  return (
    <nav aria-label="Property sections" className="overflow-x-auto border-b border-slate-200">
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-cyan-700 text-cyan-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}