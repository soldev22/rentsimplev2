import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { createLandlordTeamUser, listLandlordTeamUsers } from "@/lib/server/users"

export async function GET() {
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
    const users = await listLandlordTeamUsers(user)
    return NextResponse.json({ users })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to load landlord team users." }, { status: 500 })
  }
}

export async function POST(request: Request) {
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
    const body = (await request.json()) as {
      email?: string
      password?: string
      firstName?: string
      lastName?: string
      mobile?: string
    }

    if (!body.email?.trim() || !body.password || !body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json({ error: "First name, last name, email, and password are required." }, { status: 400 })
    }

    const createdUser = await createLandlordTeamUser(user, {
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      mobile: body.mobile,
    })

    return NextResponse.json({ user: createdUser }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "ValidationError") {
      return NextResponse.json({ error: "Invalid user details." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "UserAlreadyExists") {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to create landlord team user." }, { status: 500 })
  }
}
