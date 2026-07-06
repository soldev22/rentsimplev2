import { NextRequest, NextResponse } from "next/server"
import { getWebhookEventsByCaseId } from "@/lib/server/webhooks"
import { canManageProperties } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export async function GET(
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

    const webhookEvents = await getWebhookEventsByCaseId(caseId)
    return NextResponse.json(webhookEvents)
  } catch (error) {
    console.error("Error fetching webhook events:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch webhook events" },
      { status: 500 }
    )
  }
}
