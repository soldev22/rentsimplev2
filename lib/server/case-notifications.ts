import "server-only"

import nodemailer from "nodemailer"
import type { AuthUser, PreferredContactMethod } from "@/lib/auth"
import type { DampInspectionReport, PropertyCase } from "@/lib/types/case"
import { getApplicationByIdForSystem } from "@/lib/server/applications"
import { getUserById } from "@/lib/server/users"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? "587")
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim()

  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    return null
  }

  return { host, port, user, pass, from }
}

type TenantInfo = {
  id: string
  email: string
  firstName: string
  lastName: string
  preferredContactMethods?: PreferredContactMethod[]
}

/**
 * Get tenant info by tenancyId (which is the application ID)
 */
export async function getTenantByTenancyId(tenancyId: string): Promise<TenantInfo | null> {
  try {
    const application = await getApplicationByIdForSystem(tenancyId)
    if (!application) {
      return null
    }

    const tenant = await getUserById(application.applicantId)
    if (!tenant) {
      return null
    }

    return {
      id: tenant.id,
      email: tenant.email,
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      preferredContactMethods: tenant.applicantProfile?.preferredContactMethods,
    }
  } catch (error) {
    console.error("Error fetching tenant by tenancyId:", error)
    return null
  }
}

/**
 * Generate a dashboard link to view the case
 */
function generateCaseDashboardLink(propertyId: string, caseId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  return `${baseUrl}/dashboard/cases/${caseId}?propertyId=${propertyId}`
}

/**
 * Generate email report content
 */
function generateReportEmailContent(
  report: DampInspectionReport,
  case_: PropertyCase,
  tenant: TenantInfo,
): { subject: string; text: string; html: string } {
  const subject = `Damp Inspection Report - ${case_.title}`

  const text = `
Dear ${tenant.firstName},

Please find attached your damp inspection report for property case: ${case_.title}

Inspection Details:
- Inspector: ${report.inspectorName}
- Inspection Date: ${new Date(report.inspectionDate).toLocaleDateString("en-GB")}
- Severity Level: ${report.severityLevel}
- Root Cause: ${report.rootCause}

Findings:
${report.findings}

Recommended Action:
${report.recommendedAction}

Urgency Level: ${report.urgencyLevel}
Estimated Cost: ${report.estimatedCost ? `£${report.estimatedCost}` : "Not specified"}
Remediation Timeline: ${report.remediationTimeline}

If you have any questions, please contact the property management team.

Best regards,
RentSimple Team
  `.trim()

  const html = `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Dear <strong>${tenant.firstName}</strong>,</p>
    
    <p>Please find attached your damp inspection report for property case: <strong>${case_.title}</strong></p>
    
    <h3>Inspection Details</h3>
    <ul>
      <li><strong>Inspector:</strong> ${report.inspectorName}</li>
      <li><strong>Inspection Date:</strong> ${new Date(report.inspectionDate).toLocaleDateString("en-GB")}</li>
      <li><strong>Severity Level:</strong> ${report.severityLevel}</li>
      <li><strong>Root Cause:</strong> ${report.rootCause}</li>
    </ul>
    
    <h3>Findings</h3>
    <p>${report.findings.replace(/\n/g, "<br />")}</p>
    
    <h3>Recommended Action</h3>
    <p>${report.recommendedAction.replace(/\n/g, "<br />")}</p>
    
    <h3>Next Steps</h3>
    <ul>
      <li><strong>Urgency Level:</strong> ${report.urgencyLevel}</li>
      <li><strong>Estimated Cost:</strong> ${report.estimatedCost ? `£${report.estimatedCost}` : "Not specified"}</li>
      <li><strong>Remediation Timeline:</strong> ${report.remediationTimeline}</li>
    </ul>
    
    <p>If you have any questions, please contact the property management team.</p>
    
    <p>Best regards,<br /><strong>RentSimple Team</strong></p>
  </body>
</html>
  `.trim()

  return { subject, text, html }
}

type SendReportOptions = {
  method: "email" | "dashboard"
}

/**
 * Send inspection report to tenant via email
 */
async function sendReportViaEmail(
  report: DampInspectionReport,
  case_: PropertyCase,
  tenant: TenantInfo,
): Promise<{ success: boolean; detail: string }> {
  const config = getSmtpConfig()

  if (!config) {
    return {
      success: false,
      detail: "SMTP configuration is missing",
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })

    const { subject, text, html } = generateReportEmailContent(report, case_, tenant)

    await transporter.sendMail({
      from: config.from,
      to: tenant.email,
      subject,
      text,
      html,
    })

    return {
      success: true,
      detail: `Report sent to ${tenant.email}`,
    }
  } catch (error) {
    console.error("Error sending report email:", error)
    return {
      success: false,
      detail: error instanceof Error ? error.message : "Failed to send email",
    }
  }
}

/**
 * Generate dashboard link notification
 */
function sendReportViaDashboard(report: DampInspectionReport, case_: PropertyCase): { success: boolean; detail: string } {
  const dashboardLink = generateCaseDashboardLink(case_.propertyId, case_.id)

  return {
    success: true,
    detail: `Dashboard link: ${dashboardLink}`,
  }
}

/**
 * Send inspection report to tenant
 */
export async function sendReportToTenant(
  user: AuthUser,
  case_: PropertyCase,
  report: DampInspectionReport,
  options: SendReportOptions,
): Promise<{ success: boolean; detail: string; method: string }> {
  if (!case_.tenancyId) {
    return {
      success: false,
      detail: "Case does not have a tenancy ID",
      method: options.method,
    }
  }

  const tenant = await getTenantByTenancyId(case_.tenancyId)
  if (!tenant) {
    return {
      success: false,
      detail: "Tenant not found",
      method: options.method,
    }
  }

  // Check contact preferences
  if (
    options.method === "email" &&
    tenant.preferredContactMethods &&
    !tenant.preferredContactMethods.includes("email")
  ) {
    return {
      success: false,
      detail: "Tenant has not opted in for email notifications",
      method: options.method,
    }
  }

  let result

  if (options.method === "email") {
    result = await sendReportViaEmail(report, case_, tenant)
  } else {
    result = sendReportViaDashboard(report, case_)
  }

  // Log audit event if successful
  if (result.success) {
    try {
      await writeAuditEvent({
        entityType: "property_case",
        entityId: case_.id,
        action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
        fieldPath: `dampInspectionReports.${report.id}.sent_to_tenant`,
        oldValue: { sent: false },
        newValue: { sent: true, method: options.method, sentAt: new Date().toISOString() },
        performedBy: user.email,
        metadata: {
          propertyId: case_.propertyId,
          caseType: case_.caseType,
          tenantId: tenant.id,
          reportId: report.id,
          method: options.method,
          detail: result.detail,
        },
      })
    } catch (error) {
      console.error("Error logging audit event:", error)
    }
  }

  return {
    ...result,
    method: options.method,
  }
}
