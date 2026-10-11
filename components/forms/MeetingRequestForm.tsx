"use client"

import Link from "next/link"
import { useId, useRef, useState, type FormEvent } from "react"
import { MEETING_DAYS, MEETING_TIMES, MEETING_TYPES, isRecord, validateMeetingRequest, type MeetingErrors } from "@/lib/meeting-requests"
import { CONTACT_PHONE } from "@/lib/public-config"

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700"

export default function MeetingRequestForm({ onSuccess }: { onSuccess?: () => void }) {
  const id = useId()
  const feedback = useRef<HTMLDivElement>(null)
  const [days, setDays] = useState<string[]>([])
  const [errors, setErrors] = useState<MeetingErrors>({})
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  function fieldError(field: keyof MeetingErrors) {
    return errors[field] ? <p id={`${id}-${field}-error`} className="mt-1 text-sm text-red-700">{errors[field]}</p> : null
  }
  function accessibility(field: keyof MeetingErrors) {
    return { "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined }
  }
  function showFeedback() {
    requestAnimationFrame(() => feedback.current?.focus())
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = new FormData(event.currentTarget)
    const body = {
      firstName: form.get("firstName"), lastName: form.get("lastName"),
      phone: form.get("phone"), email: form.get("email"),
      numberOfProperties: Number(form.get("numberOfProperties")), town: form.get("town"),
      preferredDays: days, preferredTime: form.get("preferredTime"),
      meetingType: form.get("meetingType"), notes: form.get("notes"), website: form.get("website"),
    }
    const validation = validateMeetingRequest(body)
    setError("")
    if (!validation.success) {
      setErrors(validation.errors)
      setError("Please check the highlighted fields.")
      showFeedback()
      return
    }
    setErrors({})
    setSubmitting(true)
    inFlight.current = true
    try {
      const response = await fetch("/api/meeting-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validation.data, website: body.website }),
      })
      const payload: unknown = await response.json()
      if (!isRecord(payload)) throw new Error("Unexpected server response. Please try again.")
      if (!response.ok) {
        if (isRecord(payload.errors)) {
          const serverErrors: MeetingErrors = {}
          for (const field of Object.keys(body)) {
            if (typeof payload.errors[field] === "string") {
              serverErrors[field as keyof MeetingErrors] = payload.errors[field]
            }
          }
          setErrors(serverErrors)
        }
        setError(typeof payload.error === "string" ? payload.error : "Unable to submit your request. Please try again.")
      } else if (typeof payload.message === "string" && typeof payload.id === "string") {
        setConfirmation(payload.message)
        onSuccess?.()
      } else {
        throw new Error("Unexpected server response. Please try again.")
      }
    } catch (cause) {
      console.error("Meeting request submission failed.", { errorName: cause instanceof Error ? cause.name : "UnknownError" })
      setError(`We couldn't confirm whether your request was received. Please call ${CONTACT_PHONE} before submitting again.`)
    } finally {
      inFlight.current = false
      setSubmitting(false)
      showFeedback()
    }
  }

  if (confirmation) return (
    <div ref={feedback} tabIndex={-1} role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
      <h3 className="text-xl font-semibold">Thank you</h3>
      <p className="mt-3">{confirmation}</p>
      <p className="mt-3 text-sm">Your meeting is not booked until we agree the details with you.</p>
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div ref={feedback} tabIndex={-1} role={error ? "alert" : undefined}>
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>
      <fieldset disabled={submitting} className="space-y-5 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["firstName", "First name", "text", "given-name", 100],
            ["lastName", "Last name", "text", "family-name", 100],
            ["phone", "Phone", "tel", "tel", 30],
            ["email", "Email", "email", "email", 254],
            ["town", "Town", "text", "address-level2", 120],
          ] as const).map(([field, label, type, autoComplete, maxLength]) => (
            <div key={field}>
              <label htmlFor={`${id}-${field}`} className="text-sm font-medium">{label}</label>
              <input id={`${id}-${field}`} name={field} type={type} autoComplete={autoComplete} maxLength={maxLength} required className={inputClass} {...accessibility(field)} />
              {fieldError(field)}
            </div>
          ))}
          <div>
            <label htmlFor={`${id}-numberOfProperties`} className="text-sm font-medium">Number of properties</label>
            <input id={`${id}-numberOfProperties`} name="numberOfProperties" type="number" min={1} step={1} required className={inputClass} {...accessibility("numberOfProperties")} />
            {fieldError("numberOfProperties")}
          </div>
        </div>
        <fieldset aria-describedby={`${id}-days-help${errors.preferredDays ? ` ${id}-preferredDays-error` : ""}`}>
          <legend className="text-sm font-medium">Preferred days</legend>
          <p id={`${id}-days-help`} className="mt-1 text-sm text-slate-600">Choose up to 3 days, Monday to Saturday.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {MEETING_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <input type="checkbox" name="preferredDays" value={day} checked={days.includes(day)}
                  disabled={!days.includes(day) && days.length >= 3}
                  onChange={(event) => setDays((current) => event.target.checked ? [...current, day] : current.filter((item) => item !== day))} />
                {day}
              </label>
            ))}
          </div>
          {fieldError("preferredDays")}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["preferredTime", "Preferred time", MEETING_TIMES],
            ["meetingType", "Meeting type", MEETING_TYPES],
          ] as const).map(([field, label, options]) => (
            <div key={field}>
              <label htmlFor={`${id}-${field}`} className="text-sm font-medium">{label}</label>
              <select id={`${id}-${field}`} name={field} required defaultValue="" className={inputClass} {...accessibility(field)}>
                <option value="" disabled>Select an option</option>
                {options.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}
              </select>
              {fieldError(field)}
            </div>
          ))}
        </div>
        <div>
          <label htmlFor={`${id}-notes`} className="text-sm font-medium">Notes (optional)</label>
          <textarea id={`${id}-notes`} name="notes" rows={3} maxLength={2000} className={inputClass} {...accessibility("notes")} />
          {fieldError("notes")}
        </div>
        <div className="hidden" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Leave this field empty</label>
          <input id={`${id}-website`} name="website" type="text" autoComplete="off" tabIndex={-1} />
        </div>
        <p className="text-sm text-slate-600">
          We&apos;ll use your details to respond to your request. Read our{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-800 underline">privacy notice (opens in a new tab)</Link>.
        </p>
        <button type="submit" className="w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          {submitting ? "Sending request..." : "Request a meeting"}
        </button>
      </fieldset>
    </form>
  )
}
