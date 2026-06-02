# RentSimple Clerk Setup

This document describes how Clerk is used in RentSimple today.

RentSimple uses Clerk for identity, while Azure Cosmos DB remains the source of truth for app-specific user data such as role, approval status, and property access.

## Current flow

1. Users visit `/login`.
2. The page renders Clerk's prebuilt `SignIn` or `SignUp` component inside RentSimple's branded layout.
3. After authentication, the app redirects users to `/dashboard`.
4. On the first authenticated request, the server syncs the Clerk identity into Cosmos.
5. New users are created in Cosmos as:
   - `role = unallocated`
   - `approval_status = pending_approval`
6. The dashboard remains blocked until an admin approves the user and assigns a real role.

## Project files

- `app/layout.tsx`
  Wraps the app in `ClerkProvider` when valid Clerk keys are present.
- `app/login/page.tsx`
  Hosts the embedded Clerk `SignIn` and `SignUp` components.
- `proxy.ts`
  Protects dashboard and data routes with Clerk.
- `lib/server/session.ts`
  Reads the current Clerk session and resolves the matching app user.
- `lib/server/users.ts`
  Syncs Clerk users into Cosmos with the RentSimple approval model.

## Login page implementation

RentSimple does not currently use Clerk's catch-all `/sign-in` route example.

Instead, it uses a single branded page at `app/login/page.tsx` and toggles between:

- `SignIn`
- `SignUp`

The current Clerk component settings are:

```tsx
<SignIn
  path="/login"
  routing="path"
  signUpUrl="/login?mode=register"
  fallbackRedirectUrl="/dashboard"
  forceRedirectUrl="/dashboard"
/>
```

```tsx
<SignUp
  path="/login"
  routing="path"
  signInUrl="/login"
  fallbackRedirectUrl="/dashboard"
  forceRedirectUrl="/dashboard"
/>
```

## Proxy protection

RentSimple uses `proxy.ts` because this project is on Next.js 16.

Protected routes are:

- `/dashboard(.*)`
- `/api/auth/session(.*)`
- `/api/properties(.*)`

The `/login` route is intentionally public.

The proxy matcher also includes Clerk's frontend auto-proxy route:

- `/__clerk/(.*)`

When Clerk is not configured with real keys yet, the proxy falls back to `NextResponse.next()` so local development does not crash on placeholder credentials.

## Shared auth controls

RentSimple now exposes Clerk auth controls in the shared public chrome.

- Signed out users see `SignInButton` and `SignUpButton`
- Signed in users see `UserButton`
- Visibility is controlled with Clerk's `Show` component

These controls are created in `app/layout.tsx` and passed into `components/layout/AppChrome.tsx` so the public shell stays branded while using Clerk's current App Router APIs.

## Environment variables

These are the current expected Clerk environment variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/login?mode=register
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/dashboard
```

The repository currently ships placeholder values in `.env.example` and `.env.local`. Replace them with real Clerk values before testing sign-in.

## Clerk dashboard configuration

For local development, configure Clerk with these URLs:

- Application URL: `http://localhost:3000`
- Sign-in URL: `http://localhost:3000/login`
- Sign-up URL: `http://localhost:3000/login?mode=register`
- Post-auth redirect: `http://localhost:3000/dashboard`

Recommended sign-in methods for the current implementation:

- Email + Password

The custom `/login` form also handles Clerk second-factor prompts for:

- Email code
- Phone code
- Authenticator app TOTP
- Backup code

Recommended profile fields for sign-up:

- First name
- Last name

These values are used when syncing the Clerk user into Cosmos.

## Approval model

Clerk authenticates the user, but it does not decide whether that user can use the RentSimple dashboard.

Authorization remains app-owned:

- Clerk proves identity
- Cosmos stores app user data
- RentSimple checks `role` and `approval_status`

This separation is intentional.

## Local development notes

- If Clerk keys are still placeholders, the `/login` page shows a configuration message instead of crashing.
- `npm run build` is the current verified validation command.
- If `next dev` behaves as if `middleware.ts` still exists, clear `.next` and restart the dev server. This project now uses `proxy.ts`, not `middleware.ts`.

## Next steps

After Clerk is configured successfully, the next implementation step should be an admin approval UI so pending users can be reviewed, approved, and assigned roles inside the application.
