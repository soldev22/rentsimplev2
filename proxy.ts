import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const LOGIN_SENSITIVE_QUERY_PARAMS = ["email", "password"]

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next()
  }

  const sanitizedUrl = request.nextUrl.clone()
  let shouldRedirect = false

  for (const key of LOGIN_SENSITIVE_QUERY_PARAMS) {
    if (!sanitizedUrl.searchParams.has(key)) {
      continue
    }

    sanitizedUrl.searchParams.delete(key)
    shouldRedirect = true
  }

  if (!shouldRedirect) {
    return NextResponse.next()
  }

  return NextResponse.redirect(sanitizedUrl)
}

export const config = {
  matcher: ["/login", "/login/:path*"],
}
