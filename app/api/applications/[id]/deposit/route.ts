import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntity } from "@/lib/server/audit"
import {
  acknowledgeDepositForApplication,
  confirmDepositPaymentByTenant,
  confirmDepositPaymentReceivedForApplication,
  markDepositProtectionPendingForApplication,
  recordDepositProtectionForApplication,
  requestDepositForApplication,
  sendDepositReminderForApplication,
  setDepositTerminalStatusForApplication,
} from "@/lib/server/applications"
import { getClientIpAddress } from "@/lib/server/auth-security"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: string
          amount?: number
          paymentDueDate?: string
          paymentInstructions?: string
          notes?: string
          paymentDate?: string
          protectionProviderName?: string
          protectionReference?: string
          protectedAmount?: number
          protectedDate?: string
        }
      | null
    const { id } = await context.params

    let application = null

    switch (body?.action) {
      case "request":
        application = await requestDepositForApplication(user, id, {
          amount: Number(body.amount ?? 0),
          paymentDueDate: body.paymentDueDate,
          paymentInstructions: body.paymentInstructions,
          notes: body.notes,
        })
        break
      case "acknowledge":
        application = await acknowledgeDepositForApplication(user, id, {
          notes: body.notes,
          ipAddress: getClientIpAddress(request) ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        })
        break
      case "confirm_paid":
        application = await confirmDepositPaymentByTenant(user, id, {
          notes: body.notes,
        })
        break
      case "confirm_received":
        application = await confirmDepositPaymentReceivedForApplication(user, id, {
          notes: body.notes,
          paymentDate: body.paymentDate,
        })
        break
      case "mark_protection_pending":
        application = await markDepositProtectionPendingForApplication(user, id, body.notes)
        break
      case "record_protection":
        application = await recordDepositProtectionForApplication(user, id, {
          protectionProviderName: body.protectionProviderName ?? "",
          protectionReference: body.protectionReference ?? "",
          protectedAmount: Number(body.protectedAmount ?? 0),
          protectedDate: body.protectedDate,
          notes: body.notes,
        })
        break
      case "send_reminder":
        application = await sendDepositReminderForApplication(user, id)
        break
      case "mark_returned":
        application = await setDepositTerminalStatusForApplication(user, id, {
          status: "returned",
          notes: body.notes,
        })
        break
      case "mark_disputed":
        application = await setDepositTerminalStatusForApplication(user, id, {
          status: "disputed",
          notes: body.notes,
        })
        break
      default:
        return NextResponse.json({ error: "Invalid deposit action." }, { status: 400 })
    }

    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    const auditEvents = await listAuditEventsForEntity("application", application.id)
    return NextResponse.json({ application, auditEvents })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to update deposit workflow." }, { status: 500 })
  }
}