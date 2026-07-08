import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { updateLandlordProfile } from "@/lib/server/users"

export async function PUT(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (getUserRole(user) !== "landlord") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const updatedUser = await updateLandlordProfile(user, body)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        mobile: updatedUser.mobile,
        notificationProfile: updatedUser.notificationProfile ?? null,
        screeningScoreConfig: updatedUser.screeningScoreConfig ?? null,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to save landlord profile." }, { status: 500 })
  }
}
