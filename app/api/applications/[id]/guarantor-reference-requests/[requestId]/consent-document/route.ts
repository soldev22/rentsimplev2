import { NextResponse } from "next/server"
import { jsPDF } from "jspdf"

import { canReviewTenancyApplications, isPendingApproval } from "@/lib/auth"
import { getGuarantorReferenceConsentContextForRequest } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not recorded"
  }

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Date(parsed).toLocaleString("en-GB")
}

type RouteContext = {
  params: Promise<{
    id: string
    requestId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (!canReviewTenancyApplications(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, requestId } = await context.params
  const { searchParams } = new URL(request.url)
  const download = searchParams.get("download") === "1"
  const format = searchParams.get("format")?.trim().toLowerCase() ?? "html"

  const result = await getGuarantorReferenceConsentContextForRequest(user, id, requestId)

  if (result.error === "ApplicationNotFound") {
    return new Response("This guarantor request is no longer available.", { status: 404 })
  }

  if (result.error === "RequestNotFound") {
    return new Response("This guarantor declaration request could not be found.", { status: 404 })
  }

  if (result.error || !result.context) {
    return new Response("Unable to load guarantor declaration.", { status: 500 })
  }

  const consentContext = result.context

  if (format === "pdf") {
    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
    })

    const left = 48
    const right = 547
    const lineGap = 16
    let y = 54

    const writeLine = (text: string, options?: { bold?: boolean; gap?: number }) => {
      pdf.setFont("helvetica", options?.bold ? "bold" : "normal")
      const lines = pdf.splitTextToSize(text, right - left)
      for (const line of lines) {
        pdf.text(String(line), left, y)
        y += lineGap
      }
      y += options?.gap ?? 0
    }

    writeLine("Guarantor Responsibility Declaration", { bold: true, gap: 6 })
    writeLine("This copy is generated for records and court evidence where required.", { gap: 12 })

    writeLine(`Application ID: ${consentContext.applicationId}`)
    writeLine(`Property: ${consentContext.propertyAddress}`)
    writeLine(`Applicant: ${consentContext.applicantName} (${consentContext.applicantEmail})`)
    writeLine(
      `Guarantor Contact: ${consentContext.refereeName}${consentContext.refereeEmail ? ` (${consentContext.refereeEmail})` : ""}`,
    )
    writeLine(`Request Issued By: ${consentContext.requestedByEmail}`)
    writeLine(`Request Issued At: ${formatDate(consentContext.requestedAt)}`)
    writeLine(`Link Expiry: ${formatDate(consentContext.expiresAt)}`, { gap: 10 })

    writeLine("Legal Declaration and Acknowledgement", { bold: true, gap: 4 })
    writeLine(
      "1. The guarantor acknowledges that, upon acceptance, they may be required to execute or be treated as having accepted the substance of a Guarantee and Indemnity in support of the tenancy obligations of the applicant.",
    )
    writeLine(
      "2. The guarantor acknowledges that liability may be joint and several and may extend to rent, mesne profits, interest, damages, costs, losses, and other sums lawfully due under or in connection with the tenancy.",
    )
    writeLine(
      "3. The guarantor acknowledges that liability may continue for the contractual term and any statutory continuation, renewal, variation, or periodic continuation of the tenancy where enforceable in law.",
    )
    writeLine(
      "4. The guarantor acknowledges that the landlord or authorised agent may proceed directly against the guarantor without first enforcing remedies against the tenant where permitted by contract or law.",
    )
    writeLine(
      "5. The guarantor confirms that they have had adequate opportunity to seek independent legal advice and that they understand the nature and extent of the obligations before responding.",
    )
    writeLine(
      "6. The guarantor confirms that the response is provided freely, voluntarily, and with full capacity, and that they are financially able to satisfy the obligations they are agreeing to assume.",
      {
        gap: 10,
      },
    )
    writeLine(
      "Important: This declaration is provided for acknowledgement and evidential purposes and does not limit any fuller rights, remedies, or obligations contained in the final tenancy documentation.",
      {
        gap: 10,
      },
    )

    writeLine(`Recorded Response: ${consentContext.requestStatus.replaceAll("_", " ")}`)
    writeLine(`Response Recorded At: ${formatDate(consentContext.respondedAt)}`)
    writeLine(`Generated by RentSimple on ${formatDate(new Date().toISOString())}`)

    const pdfBytes = Buffer.from(pdf.output("arraybuffer"))

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": download
          ? `attachment; filename="guarantor-declaration-${consentContext.applicationId}.pdf"`
          : `inline; filename="guarantor-declaration-${consentContext.applicationId}.pdf"`,
      },
    })
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Guarantor Declaration - ${esc(consentContext.applicationId)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; margin: 0; background: #f8fafc; }
    .page { max-width: 860px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 20px 0 8px; font-size: 18px; }
    p, li { line-height: 1.6; font-size: 15px; }
    .meta { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .meta td { border: 1px solid #cbd5e1; padding: 8px; font-size: 14px; vertical-align: top; }
    .meta td:first-child { width: 240px; font-weight: 700; background: #f8fafc; }
    .status { margin-top: 14px; padding: 12px; border: 1px solid #cbd5e1; background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <main class="page">
    <h1>Guarantor Responsibility Declaration</h1>
    <p>This copy is generated for records and court evidence where required.</p>

    <table class="meta">
      <tr><td>Application ID</td><td>${esc(consentContext.applicationId)}</td></tr>
      <tr><td>Property</td><td>${esc(consentContext.propertyAddress)}</td></tr>
      <tr><td>Applicant</td><td>${esc(consentContext.applicantName)} (${esc(consentContext.applicantEmail)})</td></tr>
      <tr><td>Guarantor Contact</td><td>${esc(consentContext.refereeName)}${consentContext.refereeEmail ? ` (${esc(consentContext.refereeEmail)})` : ""}</td></tr>
      <tr><td>Request Issued By</td><td>${esc(consentContext.requestedByEmail)}</td></tr>
      <tr><td>Request Issued At</td><td>${esc(formatDate(consentContext.requestedAt))}</td></tr>
      <tr><td>Link Expiry</td><td>${esc(formatDate(consentContext.expiresAt))}</td></tr>
    </table>

    <h2>Legal Declaration and Acknowledgement</h2>
    <ol>
      <li>The guarantor acknowledges that, upon acceptance, they may be required to execute or be treated as having accepted the substance of a Guarantee and Indemnity in support of the tenancy obligations of the applicant.</li>
      <li>The guarantor acknowledges that liability may be joint and several and may extend to rent, mesne profits, interest, damages, costs, losses, and other sums lawfully due under or in connection with the tenancy.</li>
      <li>The guarantor acknowledges that liability may continue for the contractual term and any statutory continuation, renewal, variation, or periodic continuation of the tenancy where enforceable in law.</li>
      <li>The guarantor acknowledges that the landlord or authorised agent may proceed directly against the guarantor without first enforcing remedies against the tenant where permitted by contract or law.</li>
      <li>The guarantor confirms that they have had adequate opportunity to seek independent legal advice and that they understand the nature and extent of the obligations before responding.</li>
      <li>The guarantor confirms that the response is provided freely, voluntarily, and with full capacity, and that they are financially able to satisfy the obligations they are agreeing to assume.</li>
    </ol>

    <p><strong>Important:</strong> This declaration is provided for acknowledgement and evidential purposes and does not limit any fuller rights, remedies, or obligations contained in the final tenancy documentation.</p>

    <div class="status">
      <strong>Recorded Response:</strong> ${esc(consentContext.requestStatus.replaceAll("_", " "))}<br />
      <strong>Response Recorded At:</strong> ${esc(formatDate(consentContext.respondedAt))}
    </div>

    <p class="footer">Generated by RentSimple on ${esc(formatDate(new Date().toISOString()))}.</p>
  </main>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": download
        ? `attachment; filename="guarantor-declaration-${consentContext.applicationId}.html"`
        : `inline; filename="guarantor-declaration-${consentContext.applicationId}.html"`,
    },
  })
}
