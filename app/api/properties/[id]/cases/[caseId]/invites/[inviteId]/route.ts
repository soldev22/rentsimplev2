import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, getContractorInviteById, acceptContractorInvite, declineContractorInvite } from "@/lib/server/cases"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string; inviteId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, inviteId } = await params

    const invite = await getContractorInviteById(inviteId, caseId)
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    // Only the invited person can accept, or property manager can accept on their behalf
    const isPropertyManager = canManageProperties(user)
    const isInvitedPerson = invite.invitedEmail === user.email

    if (!isPropertyManager && !isInvitedPerson) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action === "accept") {
      const updated = await acceptContractorInvite(invite)

      // Write audit event
      await writeAuditEvent({
        entityType: "case_invite",
        entityId: caseId,
        action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
        fieldPath: "invite_status",
        oldValue: { status: invite.status },
        newValue: { status: "accepted" },
        performedBy: user.email,
        metadata: {
          propertyId,
          inviteId,
          invitedEmail: invite.invitedEmail,
          role: invite.role,
        },
      })

      return NextResponse.json(updated)
    } else if (action === "decline") {
      const updated = await declineContractorInvite(invite)

      // Write audit event
      await writeAuditEvent({
        entityType: "case_invite",
        entityId: caseId,
        action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
        fieldPath: "invite_status",
        oldValue: { status: invite.status },
        newValue: { status: "declined" },
        performedBy: user.email,
        metadata: {
          propertyId,
          inviteId,
          invitedEmail: invite.invitedEmail,
          role: invite.role,
        },
      })

      return NextResponse.json(updated)
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error updating invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string; inviteId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, inviteId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden: only property managers can revoke invites" }, { status: 403 })
    }

    const invite = await getContractorInviteById(inviteId, caseId)
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    // Mark as declined (soft delete)
    const updated = await declineContractorInvite(invite)

    // Write audit event
    await writeAuditEvent({
      entityType: "case_invite",
      entityId: caseId,
      action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
      fieldPath: "invite_revoked",
      oldValue: { status: invite.status },
      newValue: { status: "declined", revokedAt: new Date().toISOString() },
      performedBy: user.email,
      metadata: {
        propertyId,
        inviteId,
        invitedEmail: invite.invitedEmail,
        role: invite.role,
        reason: "revoked_by_manager",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error revoking invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
