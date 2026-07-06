import { NextRequest, NextResponse } from "next/server"
import { generateThreadSummary } from "@/lib/server/analytics"
import { canManageProperties } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: propertyId, caseId } = await params

    // Verify user can manage this property
    if (!(await canManageProperties(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const summary = await generateThreadSummary(caseId, propertyId)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("Error generating summary:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate summary" },
      { status: 500 }
    )
  }
}
