import { NextResponse } from "next/server"

export async function POST(request: Request) {
  void request
  return NextResponse.json({ error: "Local auth has been replaced by Clerk. Use the Clerk sign-in flow." }, { status: 410 })
}