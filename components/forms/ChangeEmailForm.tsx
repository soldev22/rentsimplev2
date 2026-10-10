"use client"

import { useState, type FormEvent } from "react"

type ChangeEmailFormProps = {
  currentEmail: string
  pendingEmail?: string
}

export default function ChangeEmailForm({ currentEmail, pendingEmail }: ChangeEmailFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null)
  const [awaitingEmail, setAwaitingEmail] = useState(pendingEmail ?? null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    setDevelopmentUrl(null)

    try {
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        message?: string
        developmentVerificationUrl?: string
      }

      if (!response.ok) {
        setError(data.error ?? "Unable to change your email right now.")
        return
      }

      setMessage(data.message ?? "Check your new inbox for a confirmation link.")
      setDevelopmentUrl(data.developmentVerificationUrl ?? null)
      setAwaitingEmail(newEmail.trim().toLowerCase())
      setCurrentPassword("")
      setNewEmail("")
      setIsOpen(false)
    } catch {
      setError("Unable to change your email right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sign-in email</h2>
          <p className="mt-1 text-sm text-slate-600">
            Current email: <span className="font-medium text-slate-900">{currentEmail}</span>
          </p>
          {awaitingEmail ? (
            <p className="mt-1 text-sm text-amber-700">
              Awaiting confirmation for <span className="font-medium">{awaitingEmail}</span>. Your email changes once you open the
              link sent to that address.
            </p>
          ) : null}
        </div>
        {!isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Change email
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:max-w-md">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            New email
            <input
              type="email"
              required
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Current password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
            />
          </label>
          <p className="text-xs text-slate-500">
            We&apos;ll send a confirmation link to the new address. After confirming, you&apos;ll need to sign in again with your new
            email.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send confirmation link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setError(null)
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      {developmentUrl ? (
        <p className="mt-2 break-all text-xs text-slate-600">
          Development link:{" "}
          <a href={developmentUrl} className="font-medium text-cyan-700 underline">
            {developmentUrl}
          </a>
        </p>
      ) : null}
    </section>
  )
}
