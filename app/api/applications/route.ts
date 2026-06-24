import { NextResponse } from "next/server"

import {
  createTenancyApplication,
  listApplicationsForApplicantByContinuation,
  listApplicationsForApplicantPage,
  listApplicationsForReviewByContinuation,
  listApplicationsForReviewPage,
} from "@/lib/server/applications"
import { canReviewTenancyApplications, getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export async function GET(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const page = Number.isFinite(Number(url.searchParams.get("page"))) ? Number(url.searchParams.get("page")) : 1
    const pageSize = Number.isFinite(Number(url.searchParams.get("pageSize")))
      ? Number(url.searchParams.get("pageSize"))
      : 25
    const landlordId = url.searchParams.get("landlordId") ?? undefined
    const continuationToken = url.searchParams.get("continuationToken") ?? undefined
    const maxItemCount = Number.isFinite(Number(url.searchParams.get("maxItemCount")))
      ? Number(url.searchParams.get("maxItemCount"))
      : 50

    if (continuationToken) {
      const continuationPage = canReviewTenancyApplications(user)
        ? await listApplicationsForReviewByContinuation(user, landlordId, { continuationToken, maxItemCount })
        : getUserRole(user) === "applicant"
          ? await listApplicationsForApplicantByContinuation(user, { continuationToken, maxItemCount })
          : { items: [], continuationToken: undefined, maxItemCount }

      return NextResponse.json({
        applications: continuationPage.items,
        pagination: {
          mode: "continuation",
          continuationToken: continuationPage.continuationToken,
          maxItemCount: continuationPage.maxItemCount,
        },
      })
    }

    const paged = canReviewTenancyApplications(user)
      ? await listApplicationsForReviewPage(user, landlordId, { page, pageSize })
      : getUserRole(user) === "applicant"
        ? await listApplicationsForApplicantPage(user, { page, pageSize })
        : { items: [], page, pageSize, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false }

    return NextResponse.json({ applications: paged.items, pagination: { mode: "offset", ...paged } })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to load applications." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const application = await createTenancyApplication(user, body)

    if (!application) {
      return NextResponse.json({ error: "Property not found or not available for tenancy." }, { status: 404 })
    }

    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Only applicants can submit tenancy applications." }, { status: 403 })
    }

    if (error instanceof Error && error.message === "ApplicationAlreadyExists") {
      return NextResponse.json({ error: "You already have an active application for this property." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "CreditCheckConsentRequired") {
      return NextResponse.json(
        { error: "You must explicitly consent to identity, referencing, fraud, and credit checks before submitting." },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message === "PreferredContactMethodRequired") {
      return NextResponse.json({ error: "Select at least one preferred contact method." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to create tenancy application." }, { status: 500 })
  }
}