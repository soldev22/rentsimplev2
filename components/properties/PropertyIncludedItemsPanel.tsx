"use client"

import { useState, useTransition } from "react"

import type { PropertyIncludedItem, PropertyRecord } from "@/lib/auth"

type PropertyIncludedItemsPanelProps = {
  property: PropertyRecord
  canManage: boolean
  onPropertyUpdate: (updated: PropertyRecord) => void
}

export default function PropertyIncludedItemsPanel({
  property,
  canManage,
  onPropertyUpdate,
}: PropertyIncludedItemsPanelProps) {
  const [items, setItems] = useState<PropertyIncludedItem[]>(property.includedItems ?? [])
  const [name, setName] = useState("")
  const [isElectrical, setIsElectrical] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const saveItems = (nextItems: PropertyIncludedItem[]) => {
    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includedItems: nextItems }),
      })
      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to save included items.")
        return
      }

      setItems(payload.property.includedItems ?? [])
      onPropertyUpdate(payload.property)
    })
  }

  const addItem = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const nextItems = [...items, { id: crypto.randomUUID(), name: trimmedName, isElectrical }]
    setItems(nextItems)
    setName("")
    setIsElectrical(false)
    saveItems(nextItems)
  }

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id)
    setItems(nextItems)
    saveItems(nextItems)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Included Items</h3>
        <p className="mt-1 text-sm text-slate-500">Record supplied white goods, furnishings, and appliances. Electrical items are listed for PAT testing in compliance.</p>
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {items.length ? (
        <ul className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{item.name}</span>
              <div className="flex items-center gap-3">
                {item.isElectrical ? <span className="text-xs font-semibold text-amber-800">Electrical</span> : null}
                {canManage ? (
                  <button type="button" onClick={() => removeItem(item.id)} disabled={isPending} className="text-xs font-semibold text-red-700 hover:underline">
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-slate-500">No included items recorded.</p>}

      {canManage ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="text-sm font-medium text-slate-700">
            Item
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900" placeholder="e.g. Washing machine" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isElectrical} onChange={(event) => setIsElectrical(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Electrical item
          </label>
          <button type="button" onClick={addItem} disabled={isPending || !name.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Add item
          </button>
        </div>
      ) : null}
    </section>
  )
}