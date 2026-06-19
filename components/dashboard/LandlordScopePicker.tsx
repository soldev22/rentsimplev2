"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

type LandlordScopePickerProps = {
  landlords: Array<{
    id: string
    fullName: string
  }>
  selectedLandlordId?: string
  label?: string
  allLabel?: string
}

export default function LandlordScopePicker({
  landlords,
  selectedLandlordId,
  label = "Landlord portfolio",
  allLabel = "All managed landlords",
}: LandlordScopePickerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(nextLandlordId: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (nextLandlordId) {
      params.set("landlordId", nextLandlordId)
    } else {
      params.delete("landlordId")
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Portfolio scope</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{label}</h2>
          <p className="mt-2 text-sm text-slate-600">Select a landlord to scope the current dashboard view to that managed portfolio.</p>
        </div>
        <label className="block w-full max-w-md text-sm font-medium text-slate-700">
          Select landlord
          <select
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={selectedLandlordId ?? ""}
            onChange={(event) => handleChange(event.target.value)}
          >
            <option value="">{allLabel}</option>
            {landlords.map((landlord) => (
              <option key={landlord.id} value={landlord.id}>
                {landlord.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
