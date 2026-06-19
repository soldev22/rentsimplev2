import { redirect } from "next/navigation"

import ApplicantProfileSettingsForm from "@/components/forms/ApplicantProfileSettingsForm"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) === "applicant") {
    return <ApplicantProfileSettingsForm initialApplicantProfile={user.applicantProfile} />
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Settings</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Account settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Profile and workflow settings for this role are still being expanded. Applicant profile defaults are now available on the applicant settings screen.
      </p>
    </section>
  )
}
