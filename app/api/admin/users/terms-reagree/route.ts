import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import {
  requireAllLandlordsTermsReagreementForAdmin,
  requireLandlordTermsReagreementForAdmin,
} from "@/lib/server/users"

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  let userId = ""
  let all = false

  try {
    const body = (await request.json()) as { userId?: unknown; all?: unknown }
    userId = typeof body.userId === "string" ? body.userId.trim() : ""
    all = body.all === true
  } catch {
    userId = ""
  }

  if (!all && !userId) {
    return NextResponse.json({ error: "A user id or all: true is required." }, { status: 400 })
  }

  const appOrigin = new URL(request.url).origin

  try {
    if (all) {
      const result = await requireAllLandlordsTermsReagreementForAdmin(user, appOrigin)
      return NextResponse.json({ result })
    }

    const result = await requireLandlordTermsReagreementForAdmin(user, userId, appOrigin)

    if (!result) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({ user: result.user, email: result.email })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    if (error instanceof Error && error.message === "NotLandlord") {
      return NextResponse.json(
        { error: "Save this user as a Landlord before requesting re-agreement." },
        { status: 400 },
      )
    }

    console.error("Failed to request Landlord terms re-agreement", error)
    return NextResponse.json({ error: "Unable to request Landlord terms re-agreement." }, { status: 500 })
  }
}
