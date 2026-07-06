import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, completeCaseStage } from "@/lib/server/cases"

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string
      caseId: string
      stageId: string
    }>
  }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, stageId } = await params

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
    const completionNotes = body.notes || ""

    const updated = await completeCaseStage(
      user,
      case_,
      stageId,
      completionNotes,
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error completing stage:", error)
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
