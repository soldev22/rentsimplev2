"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { isRecord, validateMeetingEmail, type MeetingRequest } from "@/lib/meeting-requests"

const statusLabels = {
  received: "Received",
  sending: "Sending / outcome not yet confirmed",
  sent: "Accepted by email provider",
  failed: "Sending failed",
  skipped: "Not sent",
}

export default function MeetingEmailThread({ request, configurationError }: { request: MeetingRequest; configurationError?: string | null }) {
  const router = useRouter()
  const [subject, setSubject] = useState("Your RentSimple meeting")
  const [text, setText] = useState("")
  const [feedback, setFeedback] = useState("")
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [attempt, setAttempt] = useState<{ id: string; subject: string; text: string } | null>(null)
  const inFlight = useRef(false)

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || configurationError) return
    const input = attempt || { id: crypto.randomUUID(), subject, text }
    if (!validateMeetingEmail(input)) {
      setFailed(true)
      setFeedback("Enter a subject of up to 200 characters and a message of up to 10000 characters.")
      return
    }
    setAttempt(input)
    inFlight.current = true
    setSending(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/admin/meeting-requests/${request.id}/emails`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      })
      const payload: unknown = await response.json()
      if (!isRecord(payload)) throw new Error("Invalid server response")
      if (!response.ok) {
        if (response.status < 500) setAttempt(null)
        setFailed(true)
        setFeedback(typeof payload.error === "string" ? payload.error : "Unable to send the email.")
        router.refresh()
        return
      }
      if (!isRecord(payload.message) || typeof payload.message.status !== "string") throw new Error("Missing delivery status")
      const status = payload.message.status
      setFailed(status !== "sent")
      if (status === "sent") {
        setFeedback("Email accepted by Postmark. Prospect replies will appear here when received. Inbox delivery is not yet confirmed.")
        setText("")
        setAttempt(null)
      } else if (status === "failed" || status === "skipped") {
        setFeedback("The email was not sent successfully. Your message is saved in the thread. Check provider logs before making another attempt.")
        setAttempt(null)
      } else {
        setFeedback("This send attempt already exists, but its outcome is not confirmed. Check Postmark before sending another copy.")
      }
      router.refresh()
    } catch (error) {
      console.error("Meeting email submission failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
      setFailed(true)
      setFeedback("Unable to confirm delivery. Refresh the thread. Retrying unchanged will check this attempt without sending a duplicate.")
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  return (
    <section aria-label={`Email conversation with ${request.firstName} ${request.lastName}`} className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Email conversation</h3>
        <button type="button" onClick={() => router.refresh()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Refresh replies</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Email to {request.email}. Replies from this address are linked to this meeting. Internal notes are never included.</p>
      {(request.emailMessages || []).length ? (
        <ol className="mt-4 space-y-3">
          {(request.emailMessages || []).map((message) => (
            <li key={message.id} className={`rounded-lg border p-4 ${message.direction === "inbound" ? "border-yellow-300 bg-yellow-100" : "border-blue-200 bg-blue-50"}`}>
              <p className="text-sm font-semibold">{message.direction === "inbound" ? `From prospect: ${request.firstName} ${request.lastName}` : `From RentSimple: ${message.performedBy || "RentSimple"}`} &middot; {statusLabels[message.status]}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>
              <h4 className="mt-2 font-semibold">{message.subject || "(No subject)"}</h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.text}</p>
              {message.attachmentCount ? <p className="mt-2 text-sm text-amber-800">{message.attachmentCount} attachment(s) were not imported. View them securely in Postmark.</p> : null}
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-slate-500">No emails recorded yet. Emails sent before conversation tracking was enabled are not imported.</p>}
      {configurationError ? <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{configurationError}</p> : null}
      <form onSubmit={send} className="mt-5 space-y-3">
        <fieldset disabled={sending || Boolean(configurationError)} className="space-y-3 disabled:opacity-60">
          <label className="block text-sm font-semibold" htmlFor={`${request.id}-email-subject`}>Subject</label>
          <input id={`${request.id}-email-subject`} value={subject} onChange={(event) => setSubject(event.target.value)} readOnly={Boolean(attempt)} required maxLength={200} className="w-full rounded-lg border border-slate-300 p-2" />
          <label className="block text-sm font-semibold" htmlFor={`${request.id}-email-text`}>Message to prospect</label>
          <textarea id={`${request.id}-email-text`} value={text} onChange={(event) => setText(event.target.value)} readOnly={Boolean(attempt)} required maxLength={10000} rows={5} className="w-full rounded-lg border border-slate-300 p-2" />
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">{sending ? "Sending..." : attempt ? "Check previous attempt" : "Send email"}</button>
        </fieldset>
        {feedback ? <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-red-700" : "text-slate-700"}`}>{feedback}</p> : null}
      </form>
    </section>
  )
}
