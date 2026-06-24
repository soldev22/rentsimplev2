import { NextResponse } from "next/server"

import { resetPasswordWithToken } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string
    password?: string
  }

  if (!body.token?.trim() || !body.password) {
    return NextResponse.json({ error: "Token and password are required." }, { status: 400 })
  }

  const result = await resetPasswordWithToken(body.token, body.password)

  if (!result.user || result.error) {
    return NextResponse.json({ error: "This password reset link is invalid or has expired." }, { status: 400 })
  }

  return NextResponse.json({ message: "Your password has been updated." })
}