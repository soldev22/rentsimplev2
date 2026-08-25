import type { PropertyRecord } from "@/lib/auth"

type PropertyHeaderEditorProps = {
  property: PropertyRecord
}

export default function PropertyHeaderEditor({ property }: PropertyHeaderEditorProps) {
  const uidToken = (property.uid ?? property.id).replace(/-/g, "").slice(-6).toUpperCase()

  return (
    <div className="w-full md:max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Property nickname
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          UID: {uidToken}
        </span>
      </div>

      <div className="text-2xl font-semibold text-slate-900">
        {property.nickname || "No nickname set"}
      </div>
    </div>
  )
}
