import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById } from "@/lib/server/cases"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { caseId } = await params
    const { searchParams } = request.nextUrl
    const propertyId = searchParams.get("propertyId")

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId query parameter required" }, { status: 400 })
    }

    // Verify user owns the property
    const property = await getPropertyForUser(user, propertyId)
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    return NextResponse.json(case_)
  } catch (error) {
    console.error("Error fetching case:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
