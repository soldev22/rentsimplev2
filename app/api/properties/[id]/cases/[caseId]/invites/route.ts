import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, getContractorInvitesByCaseId, createContractorInvite } from "@/lib/server/cases"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    const body = await request.json()
    const { invitedEmail, invitedName, role } = body

    if (!invitedEmail || !role) {
      return NextResponse.json({ error: "Email and role required" }, { status: 400 })
    }

    if (role !== "contractor" && role !== "advisor") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Create invite
    const invite = await createContractorInvite(
      caseId,
      propertyId,
      invitedEmail,
      invitedName || invitedEmail,
      role,
      user.email,
    )

    // Write audit event
    await writeAuditEvent({
      entityType: "case_invite",
      entityId: caseId,
      action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
      fieldPath: "invites",
      oldValue: { inviteCount: (await getContractorInvitesByCaseId(caseId)).length - 1 },
      newValue: { inviteCount: (await getContractorInvitesByCaseId(caseId)).length },
      performedBy: user.email,
      metadata: {
        propertyId,
        invitedEmail,
        role,
        caseType: case_.caseType,
      },
    })

    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    console.error("Error creating invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    const invites = await getContractorInvitesByCaseId(caseId)
    return NextResponse.json(invites)
  } catch (error) {
    console.error("Error fetching invites:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
