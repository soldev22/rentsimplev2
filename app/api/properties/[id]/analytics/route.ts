import { NextRequest, NextResponse } from "next/server"
import { getPropertyAnalytics } from "@/lib/server/analytics"
import { canManageProperties } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: propertyId } = await params

    // Verify user can manage this property
    if (!(await canManageProperties(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const metrics = await getPropertyAnalytics(propertyId)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
