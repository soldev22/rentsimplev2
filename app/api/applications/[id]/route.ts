import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getApplicationForApplicant, updateApplicationForApplicant, updateApplicationForReviewer } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id } = await context.params
    const application =
      getUserRole(user) === "applicant"
        ? await updateApplicationForApplicant(user, id, body)
        : await updateApplicationForReviewer(user, id, body)

    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    return NextResponse.json({ application })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "ApplicantEditLocked") {
      return NextResponse.json({ error: "This application can no longer be edited by the applicant." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "ApplicantChecklistUnavailable") {
      return NextResponse.json({ error: "Applicant sign-off is only available after the application has been approved." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "AgreementNotSentForSignature") {
      return NextResponse.json({ error: "The tenancy agreement has not been sent for signature yet." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "RequiredTenancyDocumentsNotIssued") {
      return NextResponse.json(
        { error: "The offer letter, lease, and supporting legal documents must all be issued before applicant sign-off can be recorded." },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message === "AgreementSignatureRequired") {
      return NextResponse.json({ error: "Confirm that you have completed the tenancy agreement signing step before submitting sign-off." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "ApplicantChecklistIncomplete") {
      return NextResponse.json({ error: "Complete every applicant sign-off item and enter your full name before submitting." }, { status: 400 })
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

    return NextResponse.json({ error: "Unable to update tenancy application." }, { status: 500 })
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (getUserRole(user) !== "applicant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const application = await getApplicationForApplicant(user, id)

    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    return NextResponse.json({ application })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to load tenancy application." }, { status: 500 })
  }
}