"use client"

import { useState, useEffect, useCallback } from "react"
import type { ContractorInvite } from "@/lib/auth"

type CaseInviteManagerProps = {
  caseId: string
  propertyId: string
  currentUserRole: "landlord" | "agent" | "admin"
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "accepted":
      return "bg-green-100 text-green-800"
    case "declined":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "contractor":
      return "bg-orange-100 text-orange-800"
    case "advisor":
      return "bg-purple-100 text-purple-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function CaseInviteManager({ caseId, propertyId, currentUserRole }: CaseInviteManagerProps) {
  const [invites, setInvites] = useState<ContractorInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"contractor" | "advisor">("contractor")

  const loadInvites = useCallback(async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/invites`)
      if (response.ok) {
        const data = await response.json()
        setInvites(data)
        setError(null)
      } else {
        setError("Failed to load invites")
      }
    } catch (err) {
      console.error("Error loading invites:", err)
      setError("Error loading invites")
    } finally {
      setLoading(false)
    }
  }, [propertyId, caseId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInvites()
  }, [loadInvites])

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !role) {
      setError("Email and role required")
      return
    }

    setSending(true)
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitedEmail: email,
          invitedName: name || email,
          role,
        }),
      })

      if (response.ok) {
        setEmail("")
        setName("")
        setRole("contractor")
        setShowForm(false)
        await loadInvites()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to send invite")
      }
    } catch (err) {
      console.error("Error sending invite:", err)
      setError("Error sending invite")
    } finally {
      setSending(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invite?")) {
      return
    }

    setRevoking(inviteId)
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/invites/${inviteId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await loadInvites()
      } else {
        setError("Failed to revoke invite")
      }
    } catch (err) {
      console.error("Error revoking invite:", err)
      setError("Error revoking invite")
    } finally {
      setRevoking(null)
    }
  }

  if (loading) {
    return <div className="text-center py-6 text-gray-600">Loading invites...</div>
  }

  const isPropertyManager = ["landlord", "agent", "admin"].includes(currentUserRole)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Team Access</h3>
        {isPropertyManager && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {showForm ? "Cancel" : "Invite Team Member"}
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>}

      {/* Invite form */}
      {showForm && isPropertyManager && (
        <form onSubmit={handleSendInvite} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contractor@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "contractor" | "advisor")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
                aria-label="Select the role for this invite"
                title="Select whether this person is a contractor or advisor"
              >
                <option value="contractor">Contractor (can view & comment)</option>
                <option value="advisor">Advisor (can view & comment)</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">Both roles can view case and add comments, but cannot modify case status or archive.</p>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {sending ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      )}

      {/* Invites list */}
      {invites.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No team members invited yet.</p>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{invite.invitedName}</p>
                <p className="text-sm text-gray-600 mt-1">{invite.invitedEmail}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(invite.role)}`}>
                    {invite.role}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(invite.status)}`}>
                    {invite.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {invite.status === "accepted" ? `Accepted on ${formatDate(invite.acceptedAt!)}` : `Invited on ${formatDate(invite.invitedAt)}`}
                </p>
              </div>

              {isPropertyManager && invite.status === "pending" && (
                <button
                  onClick={() => handleRevokeInvite(invite.id)}
                  disabled={revoking === invite.id}
                  className="ml-4 px-3 py-1 text-red-600 hover:text-red-700 disabled:text-gray-400 font-medium text-sm transition-colors"
                >
                  {revoking === invite.id ? "Revoking..." : "Revoke"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-900">
          <span className="font-semibold">Permissions:</span> Contractors and advisors can view this case, add comments and read updates, but cannot
          change case status, complete stages, or archive the case. Only the property manager can manage the case workflow.
        </p>
      </div>
    </div>
  )
}
