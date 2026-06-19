import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { updateBuilderProfile } from "@/lib/server/users"

export async function PUT(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (getUserRole(user) !== "builder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const updatedUser = await updateBuilderProfile(user, body)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({ builderProfile: updatedUser.builderProfile ?? null })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to save builder profile." }, { status: 500 })
  }
}