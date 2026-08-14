"use client"

import { useState } from "react"

import type { PropertyRecord } from "@/lib/auth"

type PropertyHeaderEditorProps = {
  property: PropertyRecord
}

export default function PropertyHeaderEditor({ property }: PropertyHeaderEditorProps) {
  const [nickname, setNickname] = useState(property.nickname ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uidToken = (property.uid ?? property.id).replace(/-/g, "").slice(-6).toUpperCase()

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || "Failed to save nickname")
      }

      const payload = (await response.json().catch(() => ({ property }))) as { property?: PropertyRecord }
      if (payload.property?.nickname) {
        setNickname(payload.property.nickname)
      }
    } catch (err) {
      console.error("Error saving nickname", err)
      setError(err instanceof Error ? err.message : "Failed to save nickname")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full md:max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label htmlFor="property-nickname" className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Property nickname
        </label>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          UID: {uidToken}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="property-nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Enter a property nickname"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg font-semibold text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
