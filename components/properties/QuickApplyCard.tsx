"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { ApplicantProfileDefaults } from "@/lib/auth"

type QuickApplyCardProps = {
  propertyId: string
  propertyAddress: string
  monthlyRent: number
  applicantProfile: ApplicantProfileDefaults
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

function formatEmploymentStatus(value: ApplicantProfileDefaults["employmentStatus"]) {
  return value.replaceAll("_", " ")
}

export default function QuickApplyCard({ propertyId, propertyAddress, monthlyRent, applicantProfile }: QuickApplyCardProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isPending, startTransition] = useTransition()

  function handleQuickApply() {
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId,
            ...applicantProfile,
            creditCheckConsentGiven: consentGiven,
            creditCheckConsentGivenAt: new Date().toISOString(),
            creditCheckConsentVersion: "tenant-credit-check-consent-v1",
          }),
        })

        const payload = (await response.json()) as {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error || "Unable to submit your quick application.")
        }

        setFeedback({
          type: "success",
          message: `Application submitted for ${propertyAddress}. Redirecting to your dashboard...`,
        })

        router.push("/dashboard/applicant")
        router.refresh()
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to submit your quick application.",
        })
      }
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Quick apply</div>
        <p className="mt-2 text-sm text-slate-700">
          Use your saved applicant profile to apply faster for this property. You will still need to confirm fresh credit and referencing consent.
        </p>
      </div>

      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <button
        type="button"
        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "Hide quick apply" : "Quick apply"}
      </button>

      {isOpen ? (
        <div className="space-y-4 rounded-xl border border-sky-200 bg-white p-4 text-sm text-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Employment</div>
              <div className="mt-1 font-semibold text-slate-900">{formatEmploymentStatus(applicantProfile.employmentStatus)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Income</div>
              <div className="mt-1 font-semibold text-slate-900">£{applicantProfile.annualIncome.toLocaleString()} annual</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Occupants</div>
              <div className="mt-1 font-semibold text-slate-900">{applicantProfile.occupantCount}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Move-in date</div>
              <div className="mt-1 font-semibold text-slate-900">{applicantProfile.moveInDate || "Not set"}</div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Preferred contact</div>
            <div className="mt-1 font-semibold text-slate-900">
              {applicantProfile.preferredContactMethods.length > 0
                ? applicantProfile.preferredContactMethods.join(", ")
                : "Not set"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            This will submit an application for {propertyAddress} at £{monthlyRent.toLocaleString()} per month using your saved applicant profile.
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentGiven}
              onChange={(event) => setConsentGiven(event.target.checked)}
            />
            <span>
              I explicitly consent to RentSimple and its referencing partners carrying out identity, fraud, landlord, affordability, and credit checks for this tenancy application.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              onClick={handleQuickApply}
              disabled={isPending || !consentGiven}
            >
              {isPending ? "Submitting..." : "Confirm and apply"}
            </button>
            <Link href={`/dashboard/applicant?propertyId=${propertyId}`} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              Review full application
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}