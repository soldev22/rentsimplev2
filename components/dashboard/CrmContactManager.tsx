"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { CRM_LIMITS, type CrmContactView, type CrmErrors } from "@/lib/crm"
import { MeetingResponseError, readMeetingResponse } from "@/lib/meeting-api"

type Draft = { firstName: string; lastName: string; email: string; phone: string; company: string; town: string; note: string }

const emptyDraft: Draft = { firstName: "", lastName: "", email: "", phone: "", company: "", town: "", note: "" }
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
const buttonClass = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
const stageClass: Record<string, string> = {
  Suspect: "bg-slate-100 text-slate-800",
  Prospect: "bg-amber-100 text-amber-900",
  Allocated: "bg-emerald-100 text-emerald-900",
}

function errorsFrom(payload: Record<string, unknown>): CrmErrors {
  const errors = payload.errors
  if (!errors || typeof errors !== "object") return {}
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => typeof value === "string")) as CrmErrors
}

function messageFrom(error: unknown) {
  return error instanceof MeetingResponseError ? error.message : "Unable to reach the server. Check your connection and try again."
}

function ContactFields({ draft, setDraft, errors, emailLocked, idPrefix }: { draft: Draft; setDraft: (draft: Draft) => void; errors: CrmErrors; emailLocked: boolean; idPrefix: string }) {
  const field = (name: keyof Draft, label: string, max: number, options: { required?: boolean; type?: string } = {}) => (
    <label className="block text-sm font-medium text-slate-700" htmlFor={`${idPrefix}-${name}`}>
      {label}{options.required ? " *" : ""}
      <input
        id={`${idPrefix}-${name}`}
        className={inputClass}
        type={options.type ?? "text"}
        value={draft[name]}
        maxLength={max}
        required={options.required}
        readOnly={name === "email" && emailLocked}
        aria-invalid={Boolean(errors[name])}
        onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
      />
      {errors[name] ? <span className="mt-1 block text-xs text-red-700">{errors[name]}</span> : null}
    </label>
  )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("firstName", "First name", CRM_LIMITS.name, { required: true })}
      {field("lastName", "Last name", CRM_LIMITS.name, { required: true })}
      {field("email", emailLocked ? "Email (identity; cannot be changed)" : "Email", CRM_LIMITS.email, { required: true, type: "email" })}
      {field("phone", "Phone", 30, { type: "tel" })}
      {field("company", "Company", CRM_LIMITS.company)}
      {field("town", "Town", CRM_LIMITS.town)}
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2" htmlFor={`${idPrefix}-note`}>
        Note
        <textarea id={`${idPrefix}-note`} className={inputClass} rows={3} maxLength={CRM_LIMITS.note} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        {errors.note ? <span className="mt-1 block text-xs text-red-700">{errors.note}</span> : null}
      </label>
    </div>
  )
}

function ContactCard({ contact, onAdd }: { contact: CrmContactView; onAdd: (draft: Draft) => void }) {
  const router = useRouter()
  const manual = contact.manual
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({ firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone, company: contact.company, town: contact.town, note: manual?.note ?? "" })
  const [errors, setErrors] = useState<CrmErrors>({})
  const [feedback, setFeedback] = useState("")
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!manual) return
    setSaving(true)
    setFeedback("")
    setErrors({})
    try {
      const response = await fetch(`/api/admin/crm/contacts/${manual.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: draft.firstName, lastName: draft.lastName, phone: draft.phone, company: draft.company, town: draft.town, note: draft.note, expectedUpdatedAt: manual.updatedAt }),
      })
      const payload = await readMeetingResponse(response)
      if (!response.ok) {
        setFailed(true)
        setErrors(errorsFrom(payload))
        setFeedback(typeof payload.error === "string" ? payload.error : "Unable to save the contact.")
        return
      }
      setFailed(false)
      setFeedback(typeof payload.warning === "string" && payload.warning ? `Saved. ${payload.warning}` : "Saved.")
      setEditing(false)
      router.refresh()
    } catch (error) {
      setFailed(true)
      setFeedback(messageFrom(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{contact.firstName} {contact.lastName}</h2>
          <p className="text-sm text-slate-600">{contact.email}{contact.phone ? ` ? ${contact.phone}` : ""}{contact.company ? ` ? ${contact.company}` : ""}{contact.town ? ` ? ${contact.town}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${stageClass[contact.stage] ?? ""}`}>{contact.stage}</span>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700" aria-label={`Stage reasons for ${contact.email}`}>
        {contact.stageReasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {contact.meetings.length ? (
        <div className="mt-3 text-sm">
          <p className="font-medium text-slate-700">Meeting requests</p>
          <ul className="space-y-1">
            {contact.meetings.map((meeting) => (
              <li key={meeting.id}>
                <Link href={`/dashboard/meeting-requests?request=${meeting.id}`} className="text-cyan-800 underline">{meeting.id}</Link>{" "}
                <span className="text-slate-600">({meeting.status}{meeting.done && meeting.status !== "done" ? ", previously marked done" : ""})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {contact.accounts.length ? (
        <div className="mt-3 text-sm">
          <p className="font-medium text-slate-700">Registered accounts</p>
          <ul className="space-y-1">
            {contact.accounts.map((account) => (
              <li key={account.id}><Link href="/dashboard/users" className="text-cyan-800 underline">{account.id}</Link> <span className="text-slate-600">({account.role}, {account.approval_status})</span></li>
            ))}
          </ul>
        </div>
      ) : null}
      {manual?.note && !editing ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{manual.note}</p> : null}
      {manual ? <p className="mt-2 text-xs text-slate-500">CRM contact {manual.id} ? updated {new Date(manual.updatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} by {manual.updatedBy}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {manual && !editing ? <button type="button" className={buttonClass} onClick={() => setEditing(true)}>Edit contact</button> : null}
        {!manual ? <button type="button" className={buttonClass} onClick={() => onAdd({ ...draft, note: "" })}>Add to CRM</button> : null}
      </div>
      {manual && editing ? (
        <form className="mt-4 space-y-4" onSubmit={save} noValidate>
          <ContactFields draft={draft} setDraft={setDraft} errors={errors} emailLocked idPrefix={`edit-${manual.id}`} />
          <div className="flex gap-3">
            <button type="submit" className={buttonClass} disabled={saving}>{saving ? "Saving..." : "Save contact"}</button>
            <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      ) : null}
      {feedback ? <p role={failed ? "alert" : "status"} className={`mt-3 text-sm ${failed ? "text-red-700" : "text-emerald-800"}`}>{feedback}</p> : null}
    </li>
  )
}

export default function CrmContactManager({ contacts }: { contacts: CrmContactView[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<CrmErrors>({})
  const [feedback, setFeedback] = useState("")
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  async function create(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback("")
    setErrors({})
    try {
      const response = await fetch("/api/admin/crm/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
      const payload = await readMeetingResponse(response)
      if (!response.ok) {
        setFailed(true)
        setErrors(errorsFrom(payload))
        setFeedback(typeof payload.error === "string" ? payload.error : "Unable to add the contact.")
        return
      }
      setFailed(false)
      setFeedback(typeof payload.warning === "string" && payload.warning ? `Contact added. ${payload.warning}` : "Contact added.")
      setDraft(emptyDraft)
      router.refresh()
    } catch (error) {
      setFailed(true)
      setFeedback(messageFrom(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form id="crm-add-contact" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={create} noValidate>
        <h2 className="text-xl font-semibold text-slate-900">Add a Suspect contact</h2>
        <p className="text-sm text-slate-600">New contacts start as Suspect. The stage changes automatically when a meeting is marked done or an account is registered with this email.</p>
        <ContactFields draft={draft} setDraft={setDraft} errors={errors} emailLocked={false} idPrefix="new" />
        {errors.form ? <p role="alert" className="text-sm text-red-700">{errors.form}</p> : null}
        <button type="submit" className={buttonClass} disabled={saving}>{saving ? "Adding..." : "Add contact"}</button>
        {feedback ? <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-red-700" : "text-emerald-800"}`}>{feedback}</p> : null}
      </form>
      {contacts.length ? (
        <ul className="space-y-4" aria-label="CRM contacts">
          {contacts.map((contact) => (
            <ContactCard
              key={`${contact.key}:${contact.manual?.updatedAt ?? ""}`}
              contact={contact}
              onAdd={(prefill) => {
                setDraft(prefill)
                setErrors({})
                setFeedback("")
                document.getElementById("crm-add-contact")?.scrollIntoView({ behavior: "smooth" })
              }}
            />
          ))}
        </ul>
      ) : <p className="rounded-xl border border-slate-200 bg-white p-6">No CRM contacts or meeting enquiries yet.</p>}
    </div>
  )
}
