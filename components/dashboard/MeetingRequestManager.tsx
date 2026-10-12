"use client"

import { useRef, useState, type FormEvent } from "react"
import { isRecord, meetingEmailDraft, MEETING_STATUSES, validateMeetingRequestUpdate, type MeetingRequest } from "@/lib/meeting-requests"
import { useRouter } from "next/navigation"
import MeetingEmailThread from "@/components/dashboard/MeetingEmailThread"
import { appointmentFields, validateAppointment } from "@/lib/diary"
import { MeetingResponseError, readMeetingResponse } from "@/lib/meeting-api"

function MeetingRequestCard({ request: initialRequest, emailConfigurationError, expanded, allowDeletion }: { request: MeetingRequest; emailConfigurationError?: string | null; expanded?: boolean; allowDeletion: boolean }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [savedRequest, setSavedRequest] = useState(initialRequest)
  const request = savedRequest.updatedAt > initialRequest.updatedAt ? savedRequest : initialRequest
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [failed, setFailed] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [statusSelection, setStatusSelection] = useState({ savedStatus: request.status, value: request.status })
  const status = statusSelection.savedStatus === request.status ? statusSelection.value : request.status
  const start = request.appointment ? appointmentFields(request.appointment.startAt) : undefined
  const end = request.appointment ? appointmentFields(request.appointment.endAt) : undefined

  function prepareEmail() {
    if (!formRef.current || saving) return null
    const values = new FormData(formRef.current)
    const appointment = validateAppointment({
      date: values.get("date"), startTime: values.get("startTime"),
      endTime: values.get("endTime"), location: values.get("location"),
    })
    if (!appointment) {
      setFailed(true)
      setFeedback("Enter a valid meeting date and start/end times above before preparing the email. All times use Europe/London; end must be after start.")
      return null
    }
    setFailed(false)
    setFeedback("")
    return meetingEmailDraft(request, appointment)
  }

  async function remove() {
    if (saving || !window.confirm(`Permanently delete the meeting request from ${request.firstName} ${request.lastName}? This cannot be undone.`)) return
    setSaving(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/admin/meeting-requests/${request.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: request.updatedAt }),
      })
      const payload = await readMeetingResponse(response)
      if (!response.ok) {
        setFailed(true)
        setFeedback(typeof payload.error === "string" ? payload.error : "Unable to delete the meeting request.")
        return
      }
      if (payload.deleted !== true) throw new Error("Deletion was not confirmed")
      setDeleted(true)
      router.refresh()
    } catch (error) {
      console.error("Meeting request admin deletion failed.", { errorName: error instanceof Error ? error.name : "UnknownError", status: error instanceof MeetingResponseError ? error.status : undefined })
      setFailed(true)
      setFeedback(error instanceof MeetingResponseError ? error.message : "Unable to confirm deletion. Refresh to check the request before trying again.")
    } finally {
      setSaving(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const form = event.currentTarget
    const values = new FormData(form)
    const date = values.get("date")
    const startTime = values.get("startTime")
    const endTime = values.get("endTime")
    const location = values.get("location")
    const appointment = date || startTime || endTime || location
      ? { date, startTime, endTime, location }
      : undefined
    const body = { status: values.get("status"), note: values.get("note"), expectedUpdatedAt: request.updatedAt, appointment }
    const input = validateMeetingRequestUpdate(body)
    if (!input || (body.status === "confirmed" && !appointment)) {
      setFailed(true)
      setFeedback("Enter a valid meeting date and start/end times (Europe/London), with end after start. Avoid clock-change times that occur twice or do not exist. Keep internal notes to 2000 characters.")
      return
    }
    setSaving(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/admin/meeting-requests/${request.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const payload = await readMeetingResponse(response)
      setFailed(!response.ok)
      if (!response.ok) {
        setFeedback(typeof payload.error === "string" ? payload.error : "Unable to save changes.")
      } else {
        if (!isRecord(payload.request) || payload.request.id !== request.id || typeof payload.request.updatedAt !== "string" ||
            !Number.isFinite(Date.parse(payload.request.updatedAt))) throw new Error("Update was not confirmed")
        setSavedRequest({
          ...request, status: input.status, updatedAt: payload.request.updatedAt,
          ...(input.appointment ? { appointment: input.appointment } : {}),
        })
        const note = form.elements.namedItem("note")
        if (note instanceof HTMLTextAreaElement) note.value = ""
        const savedMessage = body.status === "confirmed" ? "Changes saved. The meeting is now in the diary."
          : body.status === "cancelled" || body.status === "new" ? "Changes saved. This meeting is not shown in the diary."
            : "Changes saved. Scheduled completed meetings remain in the diary as history."
        setFeedback(typeof payload.warning === "string" ? payload.warning : savedMessage)
        router.refresh()
      }
    } catch (error) {
      console.error("Meeting request admin save failed.", { errorName: error instanceof Error ? error.name : "UnknownError", status: error instanceof MeetingResponseError ? error.status : undefined })
      setFailed(true)
      setFeedback(error instanceof MeetingResponseError ? error.message : "Unable to confirm the update. Refresh to check the request before trying again.")
    } finally {
      setSaving(false)
    }
  }

  if (deleted) return <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Meeting request deleted.</p>

  return (
    <details id={`meeting-${request.id}`} open={expanded} className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer rounded-xl p-6 focus-visible:outline-2 focus-visible:outline-blue-700">
        <span className="mr-3 text-xl font-semibold">{request.firstName} {request.lastName}</span>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium">{request.status}</span>
        <span className="mt-2 block text-sm text-slate-500">Received {new Date(request.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</span>
      </summary>
      <div className="border-t border-slate-200 px-6 pb-6">
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold">Contact</dt><dd className="break-all">{request.email}<br />{request.phone}</dd></div>
        <div><dt className="font-semibold">Properties</dt><dd>{request.numberOfProperties} in {request.town}</dd></div>
        <div><dt className="font-semibold">Availability</dt><dd>{request.preferredDays.join(", ")}; {request.preferredTime}</dd></div>
        <div><dt className="font-semibold">Meeting type</dt><dd>{request.meetingType}</dd></div>
      </dl>
      {request.notes ? <p className="mt-4 whitespace-pre-wrap break-words text-sm"><strong>Prospect notes: </strong>{request.notes}</p> : null}
      {request.adminNotes.length ? <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
        {request.adminNotes.map((note, index) => <li key={`${note.createdAt}-${index}`} className="whitespace-pre-wrap break-words">
          <p>{note.text}</p><p className="text-xs text-slate-500">{note.performedBy} &middot; {new Date(note.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>
        </li>)}
      </ul> : null}
      <form ref={formRef} onSubmit={save} className="mt-5 space-y-3">
        <fieldset disabled={saving} className="space-y-3">
          <div>
            <label htmlFor={`${request.id}-status`} className="text-sm font-semibold">Status</label>
            <select id={`${request.id}-status`} name="status" defaultValue={request.status} key={request.updatedAt} onChange={(event) => {
              const selected = MEETING_STATUSES.find((value) => value === event.target.value)
              if (selected) setStatusSelection({ savedStatus: request.status, value: selected })
            }} className="ml-3 rounded-lg border border-slate-300 p-2">
              {MEETING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div key={`appointment-${request.updatedAt}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold">Meeting appointment</h3>
            <p className="mt-1 text-sm text-slate-600">Required to confirm. All times are UK time (Europe/London). Confirmed meetings appear in the shared diary; cancelled meetings are removed. Saving does not send an email invitation. Use meeting details in the email composer below to prepare a message, review it, then send.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold" htmlFor={`${request.id}-date`}>Date
                <input id={`${request.id}-date`} name="date" type="date" min="2000-01-01" max="2099-12-31" defaultValue={start?.date ?? ""} required={status === "confirmed"} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
              </label>
              <label className="text-sm font-semibold" htmlFor={`${request.id}-start`}>Start time
                <input id={`${request.id}-start`} name="startTime" type="time" defaultValue={start?.time ?? ""} required={status === "confirmed"} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
              </label>
              <label className="text-sm font-semibold" htmlFor={`${request.id}-end`}>End time
                <input id={`${request.id}-end`} name="endTime" type="time" defaultValue={end?.time ?? ""} required={status === "confirmed"} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
              </label>
            </div>
            <label className="mt-3 block text-sm font-semibold" htmlFor={`${request.id}-location`}>Location or video link (optional)
              <input id={`${request.id}-location`} name="location" maxLength={500} defaultValue={request.appointment?.location ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
            </label>
          </div>
          <div>
            <label htmlFor={`${request.id}-note`} className="text-sm font-semibold">Add an internal note (optional)</label>
            <textarea id={`${request.id}-note`} name="note" maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
          </div>
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">{saving ? "Saving..." : "Save changes"}</button>
          {allowDeletion ? <button type="button" onClick={remove} className="ml-3 rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50">Delete meeting</button> : null}
        </fieldset>
        {feedback ? <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-red-700" : "text-slate-700"}`}>{feedback}</p> : null}
      </form>
      {request.auditEvents.length ? <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold">Meeting audit history</summary>
        <ul className="mt-2 space-y-2">{request.auditEvents.map((event) => <li key={event.id}>
          {event.fieldPath === "appointment" ? `Meeting appointment ${event.oldValue ? "rescheduled" : "set"}` : `${String(event.oldValue)} to ${String(event.newValue)}`} by {event.performedBy} &middot; {new Date(event.timestamp).toLocaleString("en-GB", { timeZone: "Europe/London" })}
        </li>)}</ul>
      </details> : null}
      <MeetingEmailThread request={request} configurationError={emailConfigurationError} prepareMeetingEmail={prepareEmail} preparingDisabled={saving} />
      </div>
    </details>
  )
}

export default function MeetingRequestManager({ requests, emailConfigurationError, expanded = false, allowDeletion = true }: { requests: MeetingRequest[]; emailConfigurationError?: string | null; expanded?: boolean; allowDeletion?: boolean }) {
  return <div className="space-y-4">{requests.map((request) => <MeetingRequestCard key={request.id} request={request} emailConfigurationError={emailConfigurationError} expanded={expanded} allowDeletion={allowDeletion} />)}</div>
}
