import { jsPDF } from "jspdf"

import type { TenancyApplicationRecord } from "@/lib/auth"
import { buildTenancyLogText } from "@/lib/utils/tenancy-log-format"

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function createFileStem(application: TenancyApplicationRecord) {
  const safeName = `${application.applicantName}-${application.propertyAddress}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return safeName || application.id
}

export function downloadTenancyLogTxt(application: TenancyApplicationRecord) {
  const text = buildTenancyLogText(application)
  downloadBlob(`${createFileStem(application)}-tenancy-log.txt`, new Blob([text], { type: "text/plain;charset=utf-8" }))
}

export function downloadTenancyLogPdf(application: TenancyApplicationRecord) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const text = buildTenancyLogText(application)
  const margin = 40
  const lineHeight = 16
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("RentSimple Tenancy Log", margin, margin)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)

  let y = margin + 24
  const wrappedLines = doc.splitTextToSize(text.replace(/^RentSimple Tenancy Log\n\n/, ""), maxWidth) as string[]

  wrappedLines.forEach((line) => {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }

    doc.text(line, margin, y)
    y += lineHeight
  })

  doc.save(`${createFileStem(application)}-tenancy-log.pdf`)
}