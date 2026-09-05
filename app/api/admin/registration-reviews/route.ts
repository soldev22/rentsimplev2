import { NextResponse } from "next/server"

import { getUserRole } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import {
  getRegistrationAttempt,
  listRegistrationReviews,
  recordRegistrationReview,
  resolveRegistrationAttempt,
} from "@/lib/server/registration-attempts"

async function requireAdmin() {
  const user = await getSessionUser()
  return user && getUserRole(user) === "admin" ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    return NextResponse.json({ attempts: await listRegistrationReviews() })
  } catch {
    return NextResponse.json({ error: "Unable to load registration reviews." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as {
    attemptId?: string
    decision?: "approved" | "rejected"
    reason?: string
  }
  if (!body.attemptId?.trim() || !body.decision || !body.reason?.trim()) {
    return NextResponse.json({ error: "attemptId, decision, and reason are required." }, { status: 400 })
  }

  const attempt = await getRegistrationAttempt(body.attemptId.trim())
  if (!attempt || (attempt.decision !== "review" && attempt.decision !== "verification_required")) {
    return NextResponse.json({ error: "Registration attempt not found or already resolved." }, { status: 404 })
  }

  const review = await recordRegistrationReview({
    attemptId: attempt.id,
    reviewer: user.email,
    decision: body.decision,
    reason: body.reason.trim(),
  })
  await resolveRegistrationAttempt(attempt, body.decision)
  return NextResponse.json({ review }, { status: 201 })
}