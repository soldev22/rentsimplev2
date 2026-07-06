import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/cron/check-escalations
 * Webhook for external cron service (CRON-JOB.org, Vercel Cron, etc.)
 * Requires authorization header matching CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron service not configured" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Call the escalation notification endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/admin/escalation-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const data = await response.json()

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      ...data,
    })
  } catch (error) {
    console.error("Error in cron escalation check:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/check-escalations
 * Same handler for POST requests
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
