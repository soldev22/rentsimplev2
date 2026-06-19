import { NextResponse } from "next/server"

import { createSession } from "@/lib/server/session"
import { createUser } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
    firstName?: string
    lastName?: string
    mobile?: string
    accountType?: "applicant"
  }

  if (!body.email?.trim() || !body.password || !body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json(
      { error: "First name, last name, email, and password are required." },
      { status: 400 },
    )
  }

  const { user, error } = await createUser({
    email: body.email,
    password: body.password,
    firstName: body.firstName,
    lastName: body.lastName,
    mobile: body.mobile ?? "",
    requestedRole: body.accountType === "applicant" ? "applicant" : undefined,
  })

  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unable to create your account." }, { status: 400 })
  }

  await createSession(user.email)

  return NextResponse.json({ user }, { status: 201 })
}