import "server-only"

import { randomUUID } from "node:crypto"

import {
  canReviewTenancyApplications,
  getUserRole,
  type AuthUser,
  type TenancyVerificationDocument,
  type TenancyApplicationRecord,
} from "@/lib/auth"
import { writeAuditEvents } from "@/lib/server/audit"
import { getApplicationsContainer } from "@/lib/server/cosmos"
import { listPropertiesForUser } from "@/lib/server/properties"
import {
  deleteTenancyVerificationDocument,
  downloadTenancyVerificationDocument,
  uploadTenancyVerificationDocument,
} from "@/lib/server/blob"
import {
  assertReviewer,
  isValidTenancyVerificationDocumentCategory,
  getAuditMetadata,
  stripStoredCommunicationEntries,
  syncStoredCommunicationEntries,
  getApplicationById,
  canAccessApplicationForReviewer,
} from "./shared"

export async function uploadVerificationDocumentForApplication(
  user: AuthUser,
  applicationId: string,
  category: string,
  file: File,
  replaceDocumentId?: string,
) {
  assertReviewer(user)

  if (!isValidTenancyVerificationDocumentCategory(category)) {
    throw new Error("InvalidVerificationCategory")
  }

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const role = getUserRole(user)

  if (role !== "admin") {
    const accessibleProperties = await listPropertiesForUser(user)
    const hasAccess = accessibleProperties.some((property) => property.id === existingApplication.propertyId)

    if (!hasAccess) {
      throw new Error("Forbidden")
    }
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const upload = await uploadTenancyVerificationDocument({
    applicationId: existingApplication.id,
    category,
    fileName: file.name,
    fileBuffer,
    mimeType: file.type || "application/octet-stream",
  })

  const now = new Date().toISOString()
  const document: TenancyVerificationDocument = {
    id: replaceDocumentId || randomUUID(),
    category,
    fileName: file.name,
    blobName: upload.blobName,
    url: upload.url,
    contentType: file.type || "application/octet-stream",
    size: upload.size,
    uploadedAt: now,
    uploadedByEmail: user.email,
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    referencingInstruction: {
      ...existingApplication.referencingInstruction,
      verificationDocuments: [
        ...(existingApplication.referencingInstruction.verificationDocuments ?? []).filter(
          (candidate) => candidate.id !== replaceDocumentId,
        ),
        document,
      ],
    },
  }

  const replacedDocument = replaceDocumentId
    ? (existingApplication.referencingInstruction.verificationDocuments ?? []).find(
        (candidate) => candidate.id === replaceDocumentId,
      )
    : undefined

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: replaceDocumentId ? "verification_document_replaced" : "verification_document_uploaded",
      fieldPath: "referencingInstruction.verificationDocuments",
      oldValue: replacedDocument ?? null,
      newValue: document,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ])

  if (replacedDocument?.blobName) {
    await deleteTenancyVerificationDocument(replacedDocument.blobName).catch(() => undefined)
  }

  return {
    application: nextApplication,
    document,
  }
}

export async function getVerificationDocumentForApplication(user: AuthUser, applicationId: string, documentId: string) {
  const application = await getApplicationById(applicationId)

  if (!application) {
    return null
  }

  const role = getUserRole(user)

  if (role === "applicant") {
    if (application.applicantId !== user.id) {
      throw new Error("Forbidden")
    }
  } else if (canReviewTenancyApplications(user)) {
    const canAccess = await canAccessApplicationForReviewer(user, application)

    if (!canAccess) {
      throw new Error("Forbidden")
    }
  } else {
    throw new Error("Forbidden")
  }

  const document = (application.referencingInstruction.verificationDocuments ?? []).find(
    (candidate) => candidate.id === documentId,
  )

  if (!document) {
    return {
      application,
      document: null,
    }
  }

  const download = await downloadTenancyVerificationDocument(document.blobName)

  return {
    application,
    document,
    download,
  }
}

export async function deleteVerificationDocumentForApplication(user: AuthUser, applicationId: string, documentId: string) {
  assertReviewer(user)

  const application = await getApplicationById(applicationId)

  if (!application) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, application)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const existingDocuments = application.referencingInstruction.verificationDocuments ?? []
  const removedDocument = existingDocuments.find((candidate) => candidate.id === documentId)

  if (!removedDocument) {
    return {
      application,
      deleted: false,
    }
  }

  const now = new Date().toISOString()
  const nextApplication: TenancyApplicationRecord = {
    ...application,
    updatedAt: now,
    referencingInstruction: {
      ...application.referencingInstruction,
      verificationDocuments: existingDocuments.filter((candidate) => candidate.id !== documentId),
    },
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: "verification_document_deleted",
      fieldPath: "referencingInstruction.verificationDocuments",
      oldValue: removedDocument,
      newValue: null,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ])

  await deleteTenancyVerificationDocument(removedDocument.blobName).catch(() => undefined)

  return {
    application: nextApplication,
    deleted: true,
  }
}
