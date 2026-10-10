import { NextResponse } from "next/server"

import { confirmEmailChange } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string
  }

  if (!body.token?.trim()) {
    return NextResponse.json({ error: "Confirmation token is required." }, { status: 400 })
  }

  const result = await confirmEmailChange(body.token)

  if (result.error === "EmailAlreadyInUse") {
    return NextResponse.json({ error: "That email address is already used by another account." }, { status: 409 })
  }

  if (!result.user || result.error) {
    return NextResponse.json({ error: "This confirmation link is invalid or has expired." }, { status: 400 })
  }

  return NextResponse.json({
    message: "Your email address has been updated. Please sign in with your new email.",
    email: result.user.email,
  })
}
