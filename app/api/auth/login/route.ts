import { NextResponse } from "next/server"

import { createSession } from "@/lib/server/session"
import { authenticateUser } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
  }

  if (!body.email?.trim() || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
  }

  const { user, error } = await authenticateUser({
    email: body.email,
    password: body.password,
  })

  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unable to sign you in." }, { status: 401 })
  }

  await createSession(user.email)

  return NextResponse.json({ user })
}