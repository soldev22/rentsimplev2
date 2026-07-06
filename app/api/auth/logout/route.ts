import { NextResponse } from "next/server"

import { destroySession, clearInvalidSessionCookie } from "@/lib/server/session"

export async function POST() {
  await destroySession()
  await clearInvalidSessionCookie()
  return NextResponse.json({ success: true })
}