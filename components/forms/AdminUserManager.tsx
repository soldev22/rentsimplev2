"use client"

import { useDeferredValue, useState, useTransition } from "react"

import type { ApprovalStatus, AuthUser, UserRole } from "@/lib/auth"

type AgentOption = {
  id: string
  email: string
  fullName: string
}

type AdminUserManagerProps = {
  initialUsers: AuthUser[]
  initialAgents: AgentOption[]
  currentUserEmail: string
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

type UserView = "all" | "pending" | "approved"

export const SUPER_ADMIN_EMAIL = "mike@solutionsdeveloped.co.uk"

export function canAdminEditUser(userEmail: string, currentUserEmail: string) {
  const normalizedUserEmail = userEmail.trim().toLowerCase()
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase()

  return normalizedUserEmail !== normalizedCurrentUserEmail || normalizedUserEmail === SUPER_ADMIN_EMAIL
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "unallocated", label: "Unallocated" },
  { value: "applicant", label: "Applicant" },
  { value: "tenant", label: "Tenant" },
  { value: "landlord", label: "Landlord" },
  { value: "agent", label: "Agent" },
  { value: "builder", label: "Builder" },
  { value: "admin", label: "Admin" },
]

const approvalOptions: Array<{ value: ApprovalStatus; label: string }> = [
  { value: "pending_verification", label: "Pending verification" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
]

function getFullName(user: AuthUser) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return fullName || "No name set"
}

function getRoleBadgeClass(role: UserRole) {
  switch (role) {
    case "admin":
      return "bg-slate-900 text-white"
    case "landlord":
      return "bg-indigo-100 text-indigo-900"
    case "agent":
      return "bg-sky-100 text-sky-900"
    case "tenant":
      return "bg-emerald-100 text-emerald-900"
    case "applicant":
      return "bg-amber-100 text-amber-900"
    case "builder":
      return "bg-fuchsia-100 text-fuchsia-900"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function getApprovalBadgeClass(status: ApprovalStatus) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-900"
  }

  if (status === "pending_verification") {
    return "bg-sky-100 text-sky-900"
  }

  return "bg-amber-100 text-amber-900"
}

function formatPreferredContactMethods(methods: AuthUser["applicantProfile"] extends infer Profile
  ? Profile extends { preferredContactMethods: infer Methods }
    ? Methods
    : never
  : never) {
  return Array.isArray(methods) && methods.length > 0 ? methods.join(", ") : "Not set"
}

function sortUsers(users: AuthUser[]) {
  return [...users].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

function getNotificationSummary(user: AuthUser) {
  if (user.role !== "landlord") {
    return null
  }

  return {
    transactionalEmail: user.notificationProfile?.outboundEmail || user.email,
    registeredEmail: user.email,
  }
}

export default function AdminUserManager({ initialUsers, initialAgents, currentUserEmail }: AdminUserManagerProps) {
  const [users, setUsers] = useState(() => sortUsers(initialUsers))
  const [agents] = useState(initialAgents)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedView, setSelectedView] = useState<UserView>("all")
  const [savingEmail, setSavingEmail] = useState<string | null>(null)
  const [isResettingWorkspace, setIsResettingWorkspace] = useState(false)
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const deferredSearchQuery = useDeferredValue(searchQuery)

  function handleFieldChange(email: string, field: "role" | "approval_status", value: string) {
    setUsers((current) =>
      current.map((user) => {
        if (user.email !== email) {
          return user
        }

        if (field === "role") {
          const nextRole = value as UserRole

          return {
            ...user,
            role: nextRole,
            approval_status: nextRole === "unallocated" ? "pending_approval" : user.approval_status,
          }
        }

        return {
          ...user,
          approval_status: value as ApprovalStatus,
        }
      }),
    )
  }

  function handleUserDetailChange(email: string, field: "first_name" | "last_name" | "mobile", value: string) {
    setUsers((current) =>
      current.map((user) => (user.email === email ? { ...user, [field]: value } : user)),
    )
  }

  function persistUserUpdate(user: AuthUser, successMessage: string) {
    setFeedback(null)
    setSavingEmail(user.email)

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            mobile: user.mobile,
            role: user.role,
            approval_status: user.role === "unallocated" ? "pending_approval" : user.approval_status,
            managedByAgentId: user.role === "landlord" ? user.managedByAgentId ?? null : null,
            notificationProfile:
              user.role === "landlord"
                ? {
                    outboundEmail: user.notificationProfile?.outboundEmail ?? "",
                    copyLandlordOnTenantEmails: false,
                  }
                : null,
          }),
        })

        const payload = (await response.json()) as {
          user?: AuthUser
          error?: string
        }

        if (!response.ok || !payload.user) {
          throw new Error(payload.error || "Unable to update user.")
        }

        setUsers((current) => sortUsers(current.map((candidate) => (candidate.email === payload.user?.email ? payload.user : candidate))))
        setFeedback({
          type: "success",
          message: successMessage,
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to update user.",
        })
      } finally {
        setSavingEmail(null)
      }
    })
  }

  function saveUser(user: AuthUser) {
    persistUserUpdate(user, `Updated ${getFullName(user)}.`)
  }

  function approveUserAsApplicant(user: AuthUser) {
    persistUserUpdate(
      {
        ...user,
        role: "applicant",
        approval_status: "approved",
      },
      `Approved ${getFullName(user)} as an applicant.`,
    )
  }

  function resetWorkspace() {
    const confirmed = window.confirm(
      "Delete all applications, properties, and property images while keeping all user accounts?",
    )

    if (!confirmed) {
      return
    }

    setFeedback(null)
    setIsResettingWorkspace(true)

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/reset-workspace", {
          method: "POST",
        })

        const payload = (await response.json()) as {
          result?: {
            deletedApplications: number
            deletedProperties: number
          }
          error?: string
        }

        if (!response.ok || !payload.result) {
          throw new Error(payload.error || "Unable to reset workspace data.")
        }

        setUsers((current) => sortUsers(current))
        setFeedback({
          type: "success",
          message: `Workspace reset complete. Deleted ${payload.result.deletedApplications} applications and ${payload.result.deletedProperties} properties while preserving all user accounts.`,
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to reset workspace data.",
        })
      } finally {
        setIsResettingWorkspace(false)
      }
    })
  }

  function actAsUser(user: AuthUser) {
    if (user.email === currentUserEmail) {
      return
    }

    const confirmed = window.confirm(`Switch into ${getFullName(user)} (${user.email}) for testing?`)

    if (!confirmed) {
      return
    }

    setFeedback(null)
    setSwitchingEmail(user.email)

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/act-as", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: user.email }),
        })

        const payload = (await response.json()) as {
          ok?: boolean
          redirectTo?: string
          error?: string
        }

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to switch user.")
        }

        window.location.assign(payload.redirectTo || "/dashboard")
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to switch user.",
        })
        setSwitchingEmail(null)
      }
    })
  }

  function deleteUser(user: AuthUser) {
    if (user.email === currentUserEmail) {
      return
    }

    const confirmed = window.confirm(`Delete ${getFullName(user)} (${user.email})? This cannot be undone.`)

    if (!confirmed) {
      return
    }

    setFeedback(null)
    setSavingEmail(user.email)

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: user.email }),
        })

        const payload = (await response.json()) as {
          deleted?: boolean
          error?: string
        }

        if (!response.ok || !payload.deleted) {
          throw new Error(payload.error || "Unable to delete user.")
        }

        setUsers((current) => sortUsers(current.filter((candidate) => candidate.email !== user.email)))
        setFeedback({
          type: "success",
          message: `Deleted ${getFullName(user)} (${user.email}).`,
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to delete user.",
        })
      } finally {
        setSavingEmail(null)
      }
    })
  }

  const pendingCount = users.filter((user) => user.approval_status !== "approved").length
  const approvedCount = users.filter((user) => user.approval_status === "approved").length
  const pendingUsers = users.filter((user) => user.approval_status !== "approved")
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()
  const filteredUsers = users.filter((user) => {
    const matchesView =
      selectedView === "all"
        ? true
        : selectedView === "pending"
          ? user.approval_status !== "approved"
          : user.approval_status === "approved"

    if (!matchesView) {
      return false
    }

    if (!normalizedSearchQuery) {
      return true
    }

    const searchableText = [user.first_name, user.last_name, user.email, user.mobile, user.role]
      .join(" ")
      .toLowerCase()

    return searchableText.includes(normalizedSearchQuery)
  })

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">User management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Review accounts, approve access, and assign the role each person needs in RentSimple.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total users</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{users.length}</div>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-700">Pending</div>
              <div className="mt-2 text-2xl font-semibold text-amber-900">{pendingCount}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Approved</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-900">{approvedCount}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-700">Testing reset</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Reset workflow data</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              Delete all workspace data, non-admin user accounts, properties, images, and application records while
              preserving the admin account you are currently signed in with.
            </p>
          </div>
          <button
            type="button"
            onClick={resetWorkspace}
            disabled={isResettingWorkspace}
            className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResettingWorkspace ? "Resetting..." : "Reset test data"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Approval queue</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Pending approvals</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              New accounts land here first. Approve the common case in one click, or use the full table below for other role assignments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedView("pending")}
            className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
          >
            Show pending only
          </button>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-white/80 p-5 text-sm text-slate-600">
            No accounts are waiting for approval right now.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {pendingUsers.map((user) => (
              <div key={user.email} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{getFullName(user)}</div>
                    <div className="mt-1 text-sm text-slate-600">{user.email}</div>
                    <div className="mt-1 text-sm text-slate-500">{user.mobile || "No mobile number"}</div>
                  </div>
                  <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
                    {user.approval_status === "pending_verification" ? "Pending verification" : "Pending approval"}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => approveUserAsApplicant(user)}
                    disabled={isPending && savingEmail === user.email}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending && savingEmail === user.email ? "Approving..." : "Approve as applicant"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(user.email)
                      setSelectedView("all")
                    }}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Review in table
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Directory</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">User directory</h2>
            <p className="mt-2 text-sm text-slate-600">Search the account list and narrow it to pending or approved users.</p>
          </div>
          <div className="w-full max-w-md">
            <label className="block text-sm font-medium text-slate-700">
              Search users
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                type="search"
                name="user-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, email, phone, or role"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {([
            { value: "all", label: `All users (${users.length})` },
            { value: "pending", label: `Pending (${pendingCount})` },
            { value: "approved", label: `Approved (${approvedCount})` },
          ] as Array<{ value: UserView; label: string }>).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedView(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedView === option.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Approval</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                (() => {
                  const isCurrentAdmin = user.email.toLowerCase() === currentUserEmail.toLowerCase()
                  const canEditProfile = canAdminEditUser(user.email, currentUserEmail)

                  return (
                <tr key={user.email} className="align-top">
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        First name
                        <input
                          aria-label={`First name for ${user.email}`}
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
                          value={user.first_name}
                          onChange={(event) => handleUserDetailChange(user.email, "first_name", event.target.value)}
                          disabled={isCurrentAdmin && !canEditProfile}
                        />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Last name
                        <input
                          aria-label={`Last name for ${user.email}`}
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
                          value={user.last_name}
                          onChange={(event) => handleUserDetailChange(user.email, "last_name", event.target.value)}
                          disabled={isCurrentAdmin && !canEditProfile}
                        />
                      </label>
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{user.id}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    <div>{user.email}</div>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Mobile
                      <input
                        aria-label={`Mobile number for ${user.email}`}
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
                        value={user.mobile}
                        onChange={(event) => handleUserDetailChange(user.email, "mobile", event.target.value)}
                        disabled={isCurrentAdmin && !canEditProfile}
                      />
                    </label>
                    {getNotificationSummary(user) ? (
                      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-slate-700">
                        <div className="font-semibold uppercase tracking-[0.16em] text-violet-800">Notification routing</div>
                        <div className="mt-2">Transactional landlord email: {getNotificationSummary(user)?.transactionalEmail}</div>
                        <div className="mt-1">Registered onboarding email: {getNotificationSummary(user)?.registeredEmail}</div>
                      </div>
                    ) : null}
                    {user.applicantProfile ? (
                      <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-slate-700">
                        <div className="font-semibold uppercase tracking-[0.16em] text-sky-800">Applicant profile</div>
                        <div className="mt-2">Employment: {user.applicantProfile.employmentStatus.replaceAll("_", " ")}</div>
                        <div className="mt-1">Income: £{user.applicantProfile.annualIncome.toLocaleString()} annual</div>
                        <div className="mt-1">Occupants: {user.applicantProfile.occupantCount}</div>
                        <div className="mt-1">Move-in date: {user.applicantProfile.moveInDate || "Not set"}</div>
                        <div className="mt-1">Preferred contact: {formatPreferredContactMethods(user.applicantProfile.preferredContactMethods)}</div>
                        <div className="mt-1">Pets: {user.applicantProfile.hasPets ? user.applicantProfile.petDetails || "Yes" : "No"}</div>
                        <div className="mt-1">Smokes: {user.applicantProfile.smokes ? "Yes" : "No"}</div>
                        <div className="mt-1">
                          Adverse credit: {user.applicantProfile.hasAdverseCredit ? user.applicantProfile.adverseCreditDetails || "Disclosed" : "No"}
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className={`mb-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </div>
                    <select
                      aria-label={`Role for ${user.email}`}
                      title={`Role for ${user.email}`}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
                      value={user.role}
                      onChange={(event) => handleFieldChange(user.email, "role", event.target.value)}
                      disabled={isCurrentAdmin}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {user.role === "landlord" ? (
                      <div className="mt-3 space-y-3">
                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Managed by agent
                          <select
                            aria-label={`Managing agent for ${user.email}`}
                            title={`Managing agent for ${user.email}`}
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
                            value={user.managedByAgentId ?? ""}
                            onChange={(event) =>
                              setUsers((current) =>
                                current.map((candidate) =>
                                  candidate.email === user.email
                                    ? {
                                        ...candidate,
                                        managedByAgentId: event.target.value || undefined,
                                      }
                                    : candidate,
                                ),
                              )
                            }
                          >
                            <option value="">Unassigned</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.fullName}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Transactional landlord email
                          <input
                            aria-label={`Outbound email for ${user.email}`}
                            title={`Outbound email for ${user.email}`}
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
                            type="email"
                            value={user.notificationProfile?.outboundEmail ?? ""}
                            placeholder={user.email}
                            onChange={(event) =>
                              setUsers((current) =>
                                current.map((candidate) =>
                                  candidate.email === user.email
                                    ? {
                                        ...candidate,
                                        notificationProfile: {
                                          outboundEmail: event.target.value,
                                          copyLandlordOnTenantEmails: Boolean(candidate.notificationProfile?.copyLandlordOnTenantEmails),
                                        },
                                      }
                                    : candidate,
                                ),
                              )
                            }
                          />
                        </label>
                        <p className="text-xs text-slate-500">
                          Tenant correspondence uses this landlord transaction address in the app and always copies the landlord&apos;s registered onboarding email when it differs.
                        </p>
                      </div>
                    ) : null}
                    {user.role === "agent" ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        Agents can manage the workflow, but legal correspondence is routed between the tenant and the landlord&apos;s transactional email and copied to the landlord&apos;s registered onboarding email.
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className={`mb-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getApprovalBadgeClass(user.approval_status)}`}>
                      {user.approval_status === "approved"
                        ? "Approved"
                        : user.approval_status === "pending_verification"
                          ? "Pending verification"
                          : "Pending approval"}
                    </div>
                    <select
                      aria-label={`Approval status for ${user.email}`}
                      title={`Approval status for ${user.email}`}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
                      value={user.role === "unallocated" ? "pending_approval" : user.approval_status}
                      onChange={(event) => handleFieldChange(user.email, "approval_status", event.target.value)}
                      disabled={user.role === "unallocated" || isCurrentAdmin}
                    >
                      {approvalOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => saveUser(user)}
                        disabled={isCurrentAdmin && !canEditProfile || (isPending && savingEmail === user.email)}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCurrentAdmin && !canEditProfile ? "Current admin" : isPending && savingEmail === user.email ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => actAsUser(user)}
                        disabled={isCurrentAdmin || (isPending && switchingEmail === user.email)}
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCurrentAdmin ? "Current admin" : isPending && switchingEmail === user.email ? "Switching..." : "Act as"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(user)}
                        disabled={isCurrentAdmin || (isPending && savingEmail === user.email)}
                        className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCurrentAdmin ? "Protected" : isPending && savingEmail === user.email ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
                  )
                })()
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No users match the current search and filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}