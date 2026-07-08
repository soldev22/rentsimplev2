"use client"

import { useState, useTransition } from "react"

import type { NotificationProfileDefaults } from "@/lib/auth"

type LandlordProfileSettingsFormProps = {
  initialProfile: {
    firstName: string
    lastName: string
    mobile: string
    email: string
    notificationProfile?: NotificationProfileDefaults
  }
}

type FormState = {
  firstName: string
  lastName: string
  mobile: string
  outboundEmail: string
  copyLandlordOnTenantEmails: boolean
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

function createInitialFormState(profile: LandlordProfileSettingsFormProps["initialProfile"]): FormState {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    mobile: profile.mobile,
    outboundEmail: profile.notificationProfile?.outboundEmail ?? "",
    copyLandlordOnTenantEmails: profile.notificationProfile?.copyLandlordOnTenantEmails ?? false,
  }
}

export default function LandlordProfileSettingsForm({ initialProfile }: LandlordProfileSettingsFormProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(initialProfile))
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isPending, startTransition] = useTransition()

  function updateField<Key extends keyof FormState>(field: Key, value: FormState[Key]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/landlord/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: formState.firstName,
            lastName: formState.lastName,
            mobile: formState.mobile,
            notificationProfile: {
              outboundEmail: formState.outboundEmail,
              copyLandlordOnTenantEmails: formState.copyLandlordOnTenantEmails,
            },
          }),
        })

        const payload = (await response.json()) as {
          profile?: {
            firstName: string
            lastName: string
            mobile: string
            notificationProfile?: NotificationProfileDefaults | null
          }
          error?: string
        }

        if (!response.ok || !payload.profile) {
          throw new Error(payload.error || "Unable to save your landlord profile.")
        }

        setFormState({
          firstName: payload.profile.firstName,
          lastName: payload.profile.lastName,
          mobile: payload.profile.mobile,
          outboundEmail: payload.profile.notificationProfile?.outboundEmail ?? "",
          copyLandlordOnTenantEmails: payload.profile.notificationProfile?.copyLandlordOnTenantEmails ?? false,
        })

        setFeedback({
          type: "success",
          message: "Landlord profile saved.",
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to save your landlord profile.",
        })
      }
    })
  }

  function handleReset() {
    setFeedback(null)
    setFormState(createInitialFormState(initialProfile))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Landlord profile</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Contact and communication settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage your profile details and tenant communication defaults used by the dashboard workflows.
          </p>
        </div>
      </div>

      {feedback ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          First name
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Last name
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Mobile
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.mobile}
            onChange={(event) => updateField("mobile", event.target.value)}
            placeholder="07123 456789"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Account email
          <input
            className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
            value={initialProfile.email}
            disabled
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Outbound tenant email (optional)
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.outboundEmail}
            onChange={(event) => updateField("outboundEmail", event.target.value)}
            placeholder="Optional dedicated sender address"
          />
          <span className="mt-2 block text-xs text-slate-500">
            Leave blank to send from your account email.
          </span>
        </label>

        <label className="lg:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={formState.copyLandlordOnTenantEmails}
            onChange={(event) => updateField("copyLandlordOnTenantEmails", event.target.checked)}
          />
          Copy me on tenant communication emails by default
        </label>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save landlord profile"}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-white"
            onClick={handleReset}
            disabled={isPending}
          >
            Reset changes
          </button>
        </div>
      </form>
    </section>
  )
}
