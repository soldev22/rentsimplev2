# RentSimple Project Context

## Project Goal

Build a scalable property management platform (RentSimple) for future SaaS/product use.

The current focus is a polished shared shell, application-owned authentication, and a Cosmos-backed foundation for core property workflows.

## Architecture Principles

- Modular structure (dashboard to modules)
- Clean separation of concerns (pages, components, server logic)
- Reusable shared chrome for public and dashboard pages
- Simple, scalable design without unnecessary framework sprawl
- Start with a working vertical slice, then expand into richer workflows

## Folder Structure

/app
  layout.tsx                     (root app layout)
  page.tsx                       (public home page body)
  login/page.tsx                 (login + registration flow)
  waiting/page.tsx               (post-registration approval screen)
  /api
    /auth
      login/route.ts             (credential login)
      logout/route.ts            (session clear)
      register/route.ts          (user creation)
      session/route.ts           (current session lookup)
    properties/route.ts          (properties API)
  /dashboard
    layout.tsx                   (dashboard route wrapper)
    page.tsx                     (dashboard landing page)
    /properties
      page.tsx                   (Cosmos-backed list)
      /[id]/page.tsx             (detail placeholder)
    /tenants
    /bookings
    /settings
    /agent
    /applicant
    /builder
    /landlord

/components
  /layout
    AppChrome.tsx                (public header/footer shell)
    DashboardShell.tsx           (dashboard sidebar/header/footer shell)

/lib
  auth.ts                        (shared auth types and helpers)
  /server
    cosmos.ts                    (server-only Cosmos client/container access)
    password.ts                  (password hashing helpers)
    properties.ts                (property queries)
    session.ts                   (cookie session helpers)
    users.ts                     (user persistence/authentication)

## Current Implemented State

- Public marketing-style shell is in place with a branded home hero, compact public header/footer, and placeholder footer links
- Login/register page now posts to Next.js route handlers instead of a third-party auth SDK
- New users are stored in Azure Cosmos DB with role `unallocated` and approval status `pending_approval`
- Waiting page remains the holding page for newly registered or unapproved users
- Dashboard shell validates the session through `/api/auth/session`
- Properties list page now reads real data through server-side Cosmos access
- Property detail page and most other dashboard modules are still placeholders/scaffolds

## UI / Layout Status

- Shared public chrome is handled in `components/layout/AppChrome.tsx`
- Shared dashboard chrome is handled in `components/layout/DashboardShell.tsx`
- Branding is centered on the existing navy / blue / sky gradient palette
- Public and dashboard footers currently use placeholder links that can be swapped as features are finalized

## Backend and Auth Status

- Supabase has been removed from the application codebase
- Auth is now application-owned through Next.js route handlers plus an HTTP-only cookie session
- Users are persisted in Cosmos DB in a `users` container keyed by normalized email
- Session hashes are stored on the user record and the browser receives only the session cookie value
- Properties are read from a Cosmos `properties` container and filtered by the current user unless the user is an admin

## Required Environment Variables

- COSMOSDB_ENDPOINT
- COSMOSDB_KEY or managed identity credentials usable by `DefaultAzureCredential`
- COSMOSDB_DATABASE
- COSMOSDB_USERS_CONTAINER
- COSMOSDB_PROPERTIES_CONTAINER

## Current Progress

- Shared public shell and dashboard shell complete
- Login / registration flow converted to app-owned auth
- Waiting / approval page in place
- Dashboard route structure in place
- Properties list page connected to Cosmos-backed data
- Property detail page still placeholder
- Placeholder dashboard module pages still present

## Near-Term Next Steps

- Add an approval/admin workflow for moving users out of `unallocated`
- Add create/edit property workflows
- Flesh out tenants, bookings, settings, and related dashboard modules
- Replace footer placeholder links with real destinations as pages are added
- Add richer Cosmos-backed data for the remaining dashboard areas

## Rules

- Do not move project into OneDrive
- Use GitHub for sync
- Keep logic simple first, scale later
