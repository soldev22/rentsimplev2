import { NextRequest, NextResponse } from "next/server"
import {
  getWebhookDeliveryStats,
  processPendingDeliveries,
} from "@/lib/server/webhooks"
import { getSessionUser } from "@/lib/server/session"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // In production, verify user is admin
    const stats = await getWebhookDeliveryStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching delivery stats:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // In production, verify user is admin
    const result = await processPendingDeliveries()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error processing deliveries:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process deliveries" },
      { status: 500 }
    )
  }
}
