"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fragment, useState, type ReactNode } from "react"

import type { LandlordTermsBlock, LandlordTermsSection } from "@/lib/landlord-terms-content"

type LandlordTermsClientProps = {
  displayName: string
  alreadyAccepted: boolean
  acceptedAt?: string
  version: string
  isPlaceholder: boolean
  sections: LandlordTermsSection[]
}

const INLINE_PATTERN = /\[([^\]]+)\]\((https?:[^)\s]+)\)|\*\*([^*]+)\*\*|\[[^\]]*\]/g

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    const key = `${index}-${match[0]}`
    if (match[2]) {
      nodes.push(
        <a key={key} href={match[2]} target="_blank" rel="noreferrer" className="text-cyan-700 underline">
          {match[1]}
        </a>,
      )
    } else if (match[3]) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900">
          {renderInline(match[3])}
        </strong>,
      )
    } else {
      nodes.push(
        <mark key={key} className="rounded bg-amber-100 px-0.5 text-amber-900">
          {match[0]}
        </mark>,
      )
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function TermsBlock({ block }: { block: LandlordTermsBlock }) {
  if (block.type === "list") {
    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {block.items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    )
  }

  if (block.type === "table") {
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-700">
          <thead>
            <tr>
              {block.headers.map((header, index) => (
                <th key={index} className="border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-900">
                  {renderInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-slate-300 bg-white px-3 py-2 align-top">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return <p className="mt-2 text-sm text-slate-700">{renderInline(block.text)}</p>
}

export default function LandlordTermsClient({
  displayName,
  alreadyAccepted,
  acceptedAt,
  version,
  isPlaceholder,
  sections,
}: LandlordTermsClientProps) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    if (!agreed) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/landlord/terms/accept", { method: "POST" })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? "Unable to record your acceptance. Please try again.")
        return
      }

      router.replace("/dashboard")
      router.refresh()
    } catch {
      setError("Unable to record your acceptance. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.replace("/login")
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center px-6 py-12">
      <div className="mb-6 flex w-full max-w-3xl items-center justify-end gap-4">
        <div className="text-right text-sm">
          <div className="font-medium text-slate-900">{displayName}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-600">Landlord</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out..." : "Logout"}
        </button>
      </div>

      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Welcome to RentSimple</p>
        <h1 className="mb-3 mt-3 text-3xl font-semibold text-slate-900">Landlord terms</h1>
        <p className="text-slate-600">
          Please read the terms below. You need to accept them before you can use your Landlord dashboard.
        </p>
        <p className="mt-2 text-xs text-slate-500">Version {version}</p>

        {isPlaceholder ? (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Draft for solicitor review:</strong> these terms are not yet final. Details we already hold have been
            filled in; <mark className="rounded bg-amber-100 px-0.5">highlighted</mark> items are still to be confirmed.
          </div>
        ) : null}

        <div className="mt-6 max-h-[32rem] space-y-6 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-6">
          {sections.map((section) => (
            <section key={section.id}>
              <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>
              {section.note ? <p className="mt-1 text-sm italic text-slate-500">{section.note}</p> : null}
              {section.blocks.map((block, index) => (
                <Fragment key={index}>
                  <TermsBlock block={block} />
                </Fragment>
              ))}
            </section>
          ))}
        </div>

        {alreadyAccepted ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <span>
              You accepted these terms
              {acceptedAt ? ` on ${new Date(acceptedAt).toLocaleString("en-GB")}` : ""}.
            </span>
            <Link href="/dashboard" className="brand-button rounded-md px-4 py-2 text-sm font-semibold">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>I have read and agree to the RentSimple Landlord terms.</span>
            </label>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>
            ) : null}

            <button
              type="button"
              onClick={handleAccept}
              disabled={!agreed || isSubmitting}
              className="brand-button rounded-md px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Accept and continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
