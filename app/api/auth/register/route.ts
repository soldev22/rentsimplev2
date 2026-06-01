import { NextResponse } from "next/server"

export async function POST(request: Request) {
  void request
  return NextResponse.json({ error: "Local registration has been replaced by Clerk. Use the Clerk sign-up flow." }, { status: 410 })
}