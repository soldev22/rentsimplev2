import { jsPDF } from "jspdf"

import type { PropertyRecord } from "@/lib/auth"

function createFileStem(property: PropertyRecord) {
  const safeName = `${property.address}-${property.city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return safeName || property.id
}

function loadImageAsJpeg(url: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext("2d")

      if (!context) {
        reject(new Error("Unable to prepare a property image."))
        return
      }

      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL("image/jpeg", 0.88))
    }
    image.onerror = () => reject(new Error("Unable to load a property image."))
    image.src = url
  })
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 15) {
  const lines = doc.splitTextToSize(text, width) as string[]
  doc.text(lines, x, y, { lineHeightFactor: lineHeight / 12 })
  return y + lines.length * lineHeight
}

export async function downloadPropertyMarketingPack(property: PropertyRecord) {
  const approvedImages = property.images.filter((image) => image.moderationStatus === "approved")
  const imageData = await Promise.all(
    approvedImages.map((image) => loadImageAsJpeg(`/api/properties/${property.id}/images/${image.id}`)),
  )
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 42
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  doc.setFillColor(8, 47, 73)
  doc.rect(0, 0, pageWidth, 108, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(24)
  doc.text("RentSimple", margin, 48)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text("Property marketing pack", margin, 72)
  y = 142

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  y = addWrappedText(doc, property.address, margin, y, contentWidth, 26) + 8
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.text([property.city, property.postcode].filter(Boolean).join(", "), margin, y)
  y += 34

  doc.setFillColor(241, 245, 249)
  doc.roundedRect(margin, y, contentWidth, 62, 8, 8, "F")
  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(`${property.type}  |  ${property.bedrooms} bed  |  ${property.bathrooms} bath`, margin + 16, y + 25)
  doc.setFont("helvetica", "normal")
  doc.text(`£${property.monthlyRent.toLocaleString("en-GB")}/month  |  ${property.status}`, margin + 16, y + 45)
  y += 94

  if (property.shortDescription) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(8, 47, 73)
    doc.text("At a glance", margin, y)
    y = addWrappedText(doc, property.shortDescription, margin, y + 22, contentWidth) + 22
  }

  if (property.longDescription) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(8, 47, 73)
    doc.text("Description", margin, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10.5)
    doc.setTextColor(51, 65, 85)
    y = addWrappedText(doc, property.longDescription, margin, y + 22, contentWidth, 15) + 18
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Prepared by RentSimple | ${new Date().toLocaleDateString("en-GB")}`, margin, pageHeight - 28)

  imageData.forEach((dataUrl, index) => {
    doc.addPage()
    doc.setTextColor(8, 47, 73)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(`${property.address} | Photo ${index + 1} of ${imageData.length}`, margin, margin)
    const imageProperties = doc.getImageProperties(dataUrl)
    const maxWidth = contentWidth
    const maxHeight = pageHeight - margin * 2 - 28
    const scale = Math.min(maxWidth / imageProperties.width, maxHeight / imageProperties.height)
    const width = imageProperties.width * scale
    const height = imageProperties.height * scale
    doc.addImage(dataUrl, "JPEG", (pageWidth - width) / 2, margin + 24 + (maxHeight - height) / 2, width, height)
  })

  doc.save(`${createFileStem(property)}-marketing-pack.pdf`)
}