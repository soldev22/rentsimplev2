"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

type SubmitState = "idle" | "submitting" | "success" | "error"

type ConsentContext = {
  applicationId: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  refereeName: string
  refereeEmail: string
  requestedByEmail: string
  requestedAt: string
  requestStatus: string
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

export default function GuarantorConsentPage() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])

  const [context, setContext] = useState<ConsentContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    let isActive = true

    async function loadContext() {
      setIsLoadingContext(true)

      try {
        const response = await fetch(`/api/guarantor/consent?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        })

        const payload = (await response.json().catch(() => null)) as { context?: ConsentContext; error?: string } | null

        if (!response.ok || !payload?.context) {
          throw new Error(payload?.error ?? "Unable to load guarantor request details.")
        }

        if (isActive) {
          setContext(payload.context)
        }
      } catch (error) {
        if (isActive) {
          setMessage(error instanceof Error ? error.message : "Unable to load guarantor request details.")
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
      setMessage("This guarantor link is missing a token.")
      return
    }

    setSubmitState("submitting")
    setMessage(null)

    try {
      const response = await fetch("/api/guarantor/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, decision }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to record your guarantor confirmation.")
      }

      setSubmitState("success")
      setMessage(payload?.message ?? "Thank you. Your guarantor confirmation has been recorded.")

      if (context) {
        setContext({
          ...context,
          requestStatus: decision === "agree" ? "completed" : "declined",
          respondedAt: new Date().toISOString(),
          canRespond: false,
          tokenConsumedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      setSubmitState("error")
      setMessage(error instanceof Error ? error.message : "Unable to record your guarantor confirmation.")
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f0ff_0%,#f7fafc_46%,#f1f5f9_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-300/30 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">RentSimple guarantor consent</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">Guarantor responsibility declaration</h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          By proceeding, you confirm that you understand this declaration and agree to act as guarantor for the tenancy
          applicant identified in the request email you received.
        </p>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Request details</h2>
          {isLoadingContext ? (
            <p className="mt-2 text-sm text-slate-600">Loading request details...</p>
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
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Applicant</dt>
                <dd>{context.applicantName} ({context.applicantEmail})</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Guarantor contact</dt>
                <dd>{context.refereeName}{context.refereeEmail ? ` (${context.refereeEmail})` : ""}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Requested by</dt>
                <dd>{context.requestedByEmail}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Requested at</dt>
                <dd>{formatDate(context.requestedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Current status</dt>
                <dd>{context.requestStatus.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-500">Responded at</dt>
                <dd>{formatDate(context.respondedAt)}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Legal declaration and acknowledgement</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              You acknowledge that, upon acceptance, you may be required to execute or be treated as having accepted the substance of a
              Guarantee and Indemnity in support of the tenancy obligations of the applicant.
            </li>
            <li>
              You acknowledge that liability may be joint and several and may extend to rent, mesne profits, interest, damages, costs,
              losses, and other sums lawfully due under or in connection with the tenancy.
            </li>
            <li>
              You acknowledge that liability may continue for the contractual term and any statutory continuation, renewal, variation, or
              periodic continuation of the tenancy where enforceable in law.
            </li>
            <li>
              You acknowledge that the landlord or authorised agent may proceed directly against you without first enforcing remedies against
              the tenant where permitted by contract or law.
            </li>
            <li>
              You confirm that you have had adequate opportunity to seek independent legal advice and that you understand the nature and
              extent of the obligations before responding.
            </li>
            <li>
              You confirm that your response is provided freely, voluntarily, and with full capacity, and that you are financially able to
              satisfy the obligations you are agreeing to assume.
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-slate-600">
            Important: This declaration is provided for acknowledgement and evidential purposes and does not limit any fuller rights,
            remedies, or obligations contained in the final tenancy documentation.
          </p>
        </section>

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
            className="rounded-md bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleDecision("agree")}
            disabled={submitState === "submitting" || submitState === "success" || (context ? !context.canRespond : false)}
          >
            {submitState === "submitting" ? "Recording..." : "I agree to act as guarantor"}
          </button>
          <button
            type="button"
            className="rounded-md border border-rose-300 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleDecision("decline")}
            disabled={submitState === "submitting" || submitState === "success" || (context ? !context.canRespond : false)}
          >
            I do not agree
          </button>
          <span className="text-xs text-slate-600">This response can only be submitted once per secure link.</span>
        </div>

        {token ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <a
              className="font-semibold text-cyan-800 underline"
              href={`/api/guarantor/consent-document?token=${encodeURIComponent(token)}`}
              target="_blank"
              rel="noreferrer"
            >
              View court copy
            </a>
            <a
              className="font-semibold text-cyan-800 underline"
              href={`/api/guarantor/consent-document?token=${encodeURIComponent(token)}&download=1`}
            >
              Download court copy (HTML)
            </a>
            <a
              className="font-semibold text-cyan-800 underline"
              href={`/api/guarantor/consent-document?token=${encodeURIComponent(token)}&format=pdf`}
              target="_blank"
              rel="noreferrer"
            >
              View court copy (PDF)
            </a>
            <a
              className="font-semibold text-cyan-800 underline"
              href={`/api/guarantor/consent-document?token=${encodeURIComponent(token)}&format=pdf&download=1`}
            >
              Download court copy (PDF)
            </a>
          </div>
        ) : null}

        {context && !context.canRespond ? (
          <p className="mt-3 text-xs text-amber-700">This link is no longer available for a new response. You can still view/download the court copy.</p>
        ) : null}
      </div>
    </main>
  )
}
