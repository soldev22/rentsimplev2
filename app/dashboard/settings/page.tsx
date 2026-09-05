import Link from "next/link"
import { redirect } from "next/navigation"

import ApplicantProfileSettingsForm from "@/components/forms/ApplicantProfileSettingsForm"
import BuilderProfileSettingsForm from "@/components/forms/BuilderProfileSettingsForm"
import LandlordProfileSettingsForm from "@/components/forms/LandlordProfileSettingsForm"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { listLandlordTeamUsers } from "@/lib/server/users"

export const dynamic = "force-dynamic"

type SettingsTab = "profile" | "screening" | "team"

function getRoleTabs(role: string): SettingsTab[] {
  if (role === "applicant") return ["profile"]
  if (role === "builder") return ["profile"]
  return role === "landlord" ? ["profile", "screening", "team"] : ["profile"]
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const currentRole = getUserRole(user)
  const activeTab: SettingsTab = params.tab === "screening" || params.tab === "team" ? params.tab : "profile"
  const tabs = getRoleTabs(currentRole)

  if (currentRole === "applicant") {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Settings</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Account settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Manage your profile details and preferred contact settings.</p>
        </div>
        <ApplicantProfileSettingsForm initialApplicantProfile={user.applicantProfile} />
      </section>
    )
  }

  if (currentRole === "builder") {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Settings</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Account settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Keep your builder profile and contact information current.</p>
        </div>
        <BuilderProfileSettingsForm initialBuilderProfile={user.builderProfile} />
      </section>
    )
  }

  if (currentRole === "landlord") {
    const teamUsers = await listLandlordTeamUsers(user)

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Settings</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Portfolio settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage your landlord profile, applicant screening, and team access from one place.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab

              return (
                <Link
                  key={tab}
                  href={`/dashboard/settings?tab=${tab}`}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tab === "profile"
                    ? "Profile"
                    : tab === "screening"
                        ? "Applicant screening"
                        : "Team logins"}
                </Link>
              )
            })}
          </div>
        </section>

        {activeTab === "profile" ? (
          <LandlordProfileSettingsForm
            initialProfile={{
              firstName: user.first_name,
              lastName: user.last_name,
              mobile: user.mobile,
              email: user.email,
              landlordProfile: user.landlordProfile,
              notificationProfile: user.notificationProfile,
              screeningScoreConfig: user.screeningScoreConfig,
            }}
            initialTeamUsers={teamUsers}
            mode="profile"
          />
        ) : activeTab === "screening" ? (
          <LandlordProfileSettingsForm
            initialProfile={{
              firstName: user.first_name,
              lastName: user.last_name,
              mobile: user.mobile,
              email: user.email,
              landlordProfile: user.landlordProfile,
              notificationProfile: user.notificationProfile,
              screeningScoreConfig: user.screeningScoreConfig,
            }}
            initialTeamUsers={teamUsers}
            mode="screening"
          />
        ) : activeTab === "team" ? (
          <LandlordProfileSettingsForm
            initialProfile={{
              firstName: user.first_name,
              lastName: user.last_name,
              mobile: user.mobile,
              email: user.email,
              landlordProfile: user.landlordProfile,
              notificationProfile: user.notificationProfile,
              screeningScoreConfig: user.screeningScoreConfig,
            }}
            initialTeamUsers={teamUsers}
            mode="team"
          />
        ) : null}
      </div>
    )
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
