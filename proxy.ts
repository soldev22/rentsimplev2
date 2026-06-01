import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_your_clerk_publishable_key"
      && process.env.CLERK_SECRET_KEY
      && process.env.CLERK_SECRET_KEY !== "sk_test_your_clerk_secret_key",
  )
}

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/auth/session(.*)",
  "/api/properties(.*)",
])

const protectedRoutesMiddleware = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect()
  }
})

export default isClerkConfigured()
  ? protectedRoutesMiddleware
  : function proxy() {
      return NextResponse.next()
    }

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
    "/(api|trpc)(.*)",
  ],
}