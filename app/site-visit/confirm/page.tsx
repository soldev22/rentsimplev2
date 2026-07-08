"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

type SubmitState = "idle" | "submitting" | "success" | "error"

type SiteVisitConsentContext = {
  applicationId: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  scheduledAt: string | null
  alternativeSuggestedAt: string | null
  assigneeName: string
  notes: string
  requestedAt: string | null
  inviteStatus: string
  respondedAt: string | null
  expiresAt: string | null
  tokenConsumedAt: string | null
  tokenExpired: boolean
  canRespond: boolean
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not recorded"
  }

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Date(parsed).toLocaleString("en-GB")
}

export default function SiteVisitConfirmPage() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])

  const [context, setContext] = useState<SiteVisitConsentContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [alternativeTime, setAlternativeTime] = useState("")

  const mapUrl = context?.propertyAddress
    ? `https://www.google.com/maps?q=${encodeURIComponent(context.propertyAddress)}&output=embed`
    : ""

  useEffect(() => {
    if (!token) {
      return
    }

    let isActive = true

    async function loadContext() {
      setIsLoadingContext(true)

      try {
        const response = await fetch(`/api/site-visit/confirm?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        })

        const payload = (await response.json().catch(() => null)) as
          | {
              context?: SiteVisitConsentContext
              error?: string
            }
          | null

        if (!response.ok || !payload?.context) {
          throw new Error(payload?.error ?? "Unable to load site visit details.")
        }

        if (isActive) {
          setContext(payload.context)
        }
      } catch (error) {
        if (isActive) {
          setMessage(error instanceof Error ? error.message : "Unable to load site visit details.")
          setSubmitState("error")
        }
      } finally {
        if (isActive) {
          setIsLoadingContext(false)
        }
      }
    }

    loadContext()

    return () => {
      isActive = false
    }
  }, [token])

  async function handleDecision(decision: "agree" | "decline") {
    if (!token) {
      setSubmitState("error")
      setMessage("This site visit link is missing a token.")
      return
    }

    setSubmitState("submitting")
    setMessage(null)

    try {
      const response = await fetch("/api/site-visit/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          decision,
          alternativeSuggestedAt:
            decision === "decline" && alternativeTime ? new Date(alternativeTime).toISOString() : undefined,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to record your site visit response.")
      }

      setSubmitState("success")
      setMessage(payload?.message ?? "Thank you. Your site visit response has been recorded.")

      if (context) {
        setContext({
          ...context,
          inviteStatus: decision === "agree" ? "confirmed" : "declined",
          respondedAt: new Date().toISOString(),
          alternativeSuggestedAt:
            decision === "decline" && alternativeTime ? new Date(alternativeTime).toISOString() : context.alternativeSuggestedAt,
          canRespond: false,
          tokenConsumedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      setSubmitState("error")
      setMessage(error instanceof Error ? error.message : "Unable to record your site visit response.")
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#f8f4ec_0%,#f1eee8_36%,#e9edf6_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-stone-200 bg-white/95 p-6 shadow-xl shadow-stone-300/30 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">RentSimple private invitation</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">Confirm your private site visit</h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          We would be delighted to host you for a tailored walkthrough of your prospective home. Please review the schedule,
          location, and host details below, then confirm whether the proposed meeting works for you.
        </p>

        <section className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Meeting details</h2>
          {isLoadingContext ? (
            <p className="mt-2 text-sm text-slate-600">Loading site visit details...</p>
          ) : context ? (
            <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Application</dt>
                <dd>{context.applicationId}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Property</dt>
                <dd>{context.propertyAddress}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Guest</dt>
                <dd>
                  {context.applicantName} ({context.applicantEmail})
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Host</dt>
                <dd>{context.assigneeName || "RentSimple team"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Proposed time</dt>
                <dd>{formatDate(context.scheduledAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Current status</dt>
                <dd>{context.inviteStatus.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Requested at</dt>
                <dd>{formatDate(context.requestedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Responded at</dt>
                <dd>{formatDate(context.respondedAt)}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        {context?.notes ? (
          <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">Concierge notes</h2>
            <p className="mt-2 leading-relaxed">{context.notes}</p>
          </section>
        ) : null}

        {mapUrl ? (
          <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Location preview</h2>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <iframe
                src={mapUrl}
                title="Site visit location map"
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        ) : null}

        {message ? (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              submitState === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleDecision("agree")}
            disabled={submitState === "submitting" || submitState === "success" || (context ? !context.canRespond : false)}
          >
            {submitState === "submitting" ? "Recording..." : "Confirm this meeting"}
          </button>
          <button
            type="button"
            className="rounded-md border border-rose-300 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleDecision("decline")}
            disabled={submitState === "submitting" || submitState === "success" || (context ? !context.canRespond : false)}
          >
            Decline this time
          </button>
          <span className="text-xs text-slate-600">This secure response can only be submitted once per link.</span>
        </div>

        {context?.canRespond ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="block text-sm font-medium text-slate-700">
              If this time does not work, suggest an alternative
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                type="datetime-local"
                value={alternativeTime}
                onChange={(event) => setAlternativeTime(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {context?.alternativeSuggestedAt ? (
          <p className="mt-3 text-xs text-slate-700">Alternative suggested: {formatDate(context.alternativeSuggestedAt)}</p>
        ) : null}

        {context && !context.canRespond ? (
          <p className="mt-3 text-xs text-amber-700">This link is no longer available for a new response.</p>
        ) : null}
      </div>
    </main>
  )
}
