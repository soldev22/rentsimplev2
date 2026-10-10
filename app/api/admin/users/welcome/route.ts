import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { resendLandlordWelcomeForAdmin } from "@/lib/server/users"

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  let userId = ""

  try {
    const body = (await request.json()) as { userId?: unknown }
    userId = typeof body.userId === "string" ? body.userId.trim() : ""
  } catch {
    userId = ""
  }

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 })
  }

  try {
    const welcomeEmail = await resendLandlordWelcomeForAdmin(user, userId, new URL(request.url).origin)

    if (!welcomeEmail) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({ welcomeEmail })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    if (error instanceof Error && error.message === "NotLandlord") {
      return NextResponse.json(
        { error: "Save this user as a Landlord before sending the welcome email." },
        { status: 400 },
      )
    }

    console.error("Failed to resend Landlord welcome email", error)
    return NextResponse.json({ error: "Unable to resend the Landlord welcome email." }, { status: 500 })
  }
}
