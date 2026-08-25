"use client"

import { useState } from "react"

import type { PropertyRecord } from "@/lib/auth"
import { downloadPropertyMarketingPack } from "@/lib/utils/property-marketing-pack"

export default function PropertyMarketingPackButton({ property }: { property: PropertyRecord }) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setError(null)
    setIsExporting(true)

    try {
      await downloadPropertyMarketingPack(property)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to create the marketing pack.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="rounded-md border border-cyan-700 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
        disabled={isExporting}
        onClick={handleExport}
      >
        {isExporting ? "Preparing pack..." : "Export marketing pack (PDF + PNGs)"}
      </button>
      {error ? <span className="max-w-64 text-right text-xs text-rose-700">{error}</span> : null}
    </div>
  )
}