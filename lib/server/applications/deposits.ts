import "server-only"

import { randomUUID } from "node:crypto"

import {
  canReviewTenancyApplications,
  type DepositDocumentRecord,
  type DepositRecord,
  getUserRole,
  type AuthUser,
} from "@/lib/auth"
import {
  sendDepositPaymentReceivedNotification,
  sendDepositProtectedNotification,
  sendDepositReminderNotification,
  sendDepositRequestedNotification,
} from "@/lib/server/notifications"
import { deleteDepositDocument, downloadDepositDocument, uploadDepositDocument } from "@/lib/server/blob"
import {
  assertReviewer,
  toNonNegativeNumber,
  normalizeDepositDocumentCategory,
  getAuditMetadata,
  persistApplicationWithAudit,
  appendDepositHistory,
  createDepositCommunicationEntry,
  mergeDepositRecord,
  canAccessApplicationForApplicantOrTenant,
  getApplicationById,
  canAccessApplicationForReviewer,
} from "./shared"

export async function requestDepositForApplication(
  user: AuthUser,
  applicationId: string,
  input: {
    amount: number
    paymentDueDate?: string
    paymentInstructions?: string
    notes?: string
  },
) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  let nextDepositRecord: DepositRecord = {
    ...existingApplication.depositRecord,
    amount: toNonNegativeNumber(input.amount),
    protectedAmount: toNonNegativeNumber(input.amount),
    paymentDueDate: typeof input.paymentDueDate === "string" ? input.paymentDueDate.trim() : "",
    paymentInstructions: typeof input.paymentInstructions === "string" ? input.paymentInstructions.trim() : "",
    notes: typeof input.notes === "string" ? input.notes.trim() : existingApplication.depositRecord.notes,
    requestedDate: now,
    requestedByEmail: user.email,
    paymentDate: undefined,
    protectedDate: undefined,
    returnedDate: undefined,
    acknowledgedAt: undefined,
    acknowledgedByUserId: undefined,
    acknowledgementIp: undefined,
    acknowledgementUserAgent: undefined,
    paymentConfirmedByTenantAt: undefined,
    paymentConfirmedByReviewerAt: undefined,
    protectionProviderName: "",
    protectionReference: "",
  }

  nextDepositRecord = appendDepositHistory(nextDepositRecord, {
    action: "deposit_requested",
    status: "requested",
    performedBy: user.email,
    timestamp: now,
    notes: input.notes,
  })

  const notificationSent = await sendDepositRequestedNotification({
    toEmail: existingApplication.applicantEmail,
    tenantName: existingApplication.applicantName,
    propertyAddress: existingApplication.propertyAddress,
    amount: nextDepositRecord.amount,
    currency: nextDepositRecord.currency,
    dueDate: nextDepositRecord.paymentDueDate || undefined,
    paymentInstructions: nextDepositRecord.paymentInstructions,
  })

  const communicationEntry = createDepositCommunicationEntry({
    occurredAt: now,
    subject: "Deposit requested",
    summary: `Deposit of ${nextDepositRecord.currency} ${nextDepositRecord.amount.toLocaleString("en-GB")} requested${nextDepositRecord.paymentDueDate ? ` by ${nextDepositRecord.paymentDueDate}` : ""}.`,
    recordedByName: user.email,
    target: existingApplication.applicantEmail,
    deliveryStatus: notificationSent ? "sent" : "failed",
    deliveryDetail: notificationSent
      ? "Deposit request email sent to tenant."
      : "Deposit request email could not be sent; dashboard record created.",
    deliverySentAt: notificationSent ? now : undefined,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
      postMoveInManagement: {
        ...existingApplication.postMoveInManagement,
        communicationEntries: [communicationEntry, ...existingApplication.postMoveInManagement.communicationEntries],
      },
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user, [
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: "deposit_requested",
      fieldPath: "depositRecord",
      oldValue: existingApplication.depositRecord,
      newValue: nextDepositRecord,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ])

  return nextApplication
}

export async function acknowledgeDepositForApplication(
  user: AuthUser,
  applicationId: string,
  input: {
    notes?: string
    ipAddress?: string
    userAgent?: string
  },
) {
  if (getUserRole(user) !== "applicant" && getUserRole(user) !== "tenant") {
    throw new Error("Forbidden")
  }

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  if (!canAccessApplicationForApplicantOrTenant(user, existingApplication)) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  let nextDepositRecord: DepositRecord = {
    ...existingApplication.depositRecord,
    acknowledgedAt: now,
    acknowledgedByUserId: user.id,
    acknowledgementIp: input.ipAddress?.trim() || undefined,
    acknowledgementUserAgent: input.userAgent?.trim() || undefined,
  }

  nextDepositRecord = appendDepositHistory(nextDepositRecord, {
    action: "deposit_acknowledged",
    status: "awaiting_payment",
    performedBy: user.email,
    timestamp: now,
    notes: input.notes,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user, [
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: "deposit_acknowledged",
      fieldPath: "depositRecord.acknowledgedAt",
      oldValue: existingApplication.depositRecord.acknowledgedAt ?? null,
      newValue: nextDepositRecord.acknowledgedAt,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ])

  return nextApplication
}

export async function confirmDepositPaymentByTenant(
  user: AuthUser,
  applicationId: string,
  input?: {
    notes?: string
  },
) {
  if (getUserRole(user) !== "applicant" && getUserRole(user) !== "tenant") {
    throw new Error("Forbidden")
  }

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  if (!canAccessApplicationForApplicantOrTenant(user, existingApplication)) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  let nextDepositRecord: DepositRecord = {
    ...existingApplication.depositRecord,
    paymentConfirmedByTenantAt: now,
  }

  nextDepositRecord = appendDepositHistory(nextDepositRecord, {
    action: "deposit_payment_confirmed_by_tenant",
    status: existingApplication.depositRecord.status === "requested" ? "awaiting_payment" : existingApplication.depositRecord.status,
    performedBy: user.email,
    timestamp: now,
    notes: input?.notes,
  })

  const communicationEntry = createDepositCommunicationEntry({
    occurredAt: now,
    subject: "Tenant marked deposit as paid",
    summary: `${existingApplication.applicantName} confirmed that the deposit payment has been made.`,
    recordedByName: user.email,
    deliveryStatus: "not_applicable",
    deliveryDetail: "Recorded in dashboard only.",
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
      postMoveInManagement: {
        ...existingApplication.postMoveInManagement,
        communicationEntries: [communicationEntry, ...existingApplication.postMoveInManagement.communicationEntries],
      },
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  return nextApplication
}

export async function confirmDepositPaymentReceivedForApplication(
  user: AuthUser,
  applicationId: string,
  input?: {
    notes?: string
    paymentDate?: string
  },
) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  const paymentDate = typeof input?.paymentDate === "string" && input.paymentDate.trim() ? input.paymentDate.trim() : now
  let nextDepositRecord: DepositRecord = {
    ...existingApplication.depositRecord,
    paymentDate,
    paymentConfirmedByReviewerAt: now,
  }

  nextDepositRecord = appendDepositHistory(nextDepositRecord, {
    action: "deposit_payment_received",
    status: "payment_received",
    performedBy: user.email,
    timestamp: now,
    notes: input?.notes,
  })

  const notificationRecipient = nextDepositRecord.requestedByEmail || user.email
  const notificationSent = await sendDepositPaymentReceivedNotification({
    toEmail: notificationRecipient,
    propertyAddress: existingApplication.propertyAddress,
    tenantName: existingApplication.applicantName,
    amount: nextDepositRecord.amount,
    currency: nextDepositRecord.currency,
  })

  const communicationEntry = createDepositCommunicationEntry({
    occurredAt: now,
    subject: "Deposit payment received",
    summary: `Deposit payment recorded as received${input?.paymentDate ? ` on ${paymentDate}` : ""}.`,
    recordedByName: user.email,
    target: notificationRecipient,
    deliveryStatus: notificationSent ? "sent" : "failed",
    deliveryDetail: notificationSent
      ? "Deposit payment received notification sent."
      : "Deposit payment received notification could not be sent.",
    deliverySentAt: notificationSent ? now : undefined,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
      postMoveInManagement: {
        ...existingApplication.postMoveInManagement,
        communicationEntries: [communicationEntry, ...existingApplication.postMoveInManagement.communicationEntries],
      },
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  return nextApplication
}

export async function markDepositProtectionPendingForApplication(user: AuthUser, applicationId: string, notes?: string) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  const nextDepositRecord = appendDepositHistory(existingApplication.depositRecord, {
    action: "deposit_payment_received",
    status: "protection_pending",
    performedBy: user.email,
    timestamp: now,
    notes,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  return nextApplication
}

export async function sendDepositReminderForApplication(user: AuthUser, applicationId: string) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  const sent = await sendDepositReminderNotification({
    toEmail: existingApplication.applicantEmail,
    tenantName: existingApplication.applicantName,
    propertyAddress: existingApplication.propertyAddress,
    amount: existingApplication.depositRecord.amount,
    currency: existingApplication.depositRecord.currency,
    dueDate: existingApplication.depositRecord.paymentDueDate || undefined,
  })

  const nextDepositRecord = {
    ...appendDepositHistory(existingApplication.depositRecord, {
      action: "deposit_reminder_sent",
      status: existingApplication.depositRecord.status,
      performedBy: user.email,
      timestamp: now,
      notes: sent ? "Deposit reminder sent." : "Deposit reminder delivery failed.",
    }),
  }

  const communicationEntry = createDepositCommunicationEntry({
    occurredAt: now,
    subject: "Deposit reminder sent",
    summary: `Reminder sent for outstanding deposit of ${existingApplication.depositRecord.currency} ${existingApplication.depositRecord.amount.toLocaleString("en-GB")}.`,
    recordedByName: user.email,
    target: existingApplication.applicantEmail,
    deliveryStatus: sent ? "sent" : "failed",
    deliveryDetail: sent ? "Deposit reminder email sent." : "Deposit reminder email could not be sent.",
    deliverySentAt: sent ? now : undefined,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
      postMoveInManagement: {
        ...existingApplication.postMoveInManagement,
        communicationEntries: [communicationEntry, ...existingApplication.postMoveInManagement.communicationEntries],
      },
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  return nextApplication
}

export async function recordDepositProtectionForApplication(
  user: AuthUser,
  applicationId: string,
  input: {
    protectionProviderName: string
    protectionReference: string
    protectedAmount: number
    protectedDate?: string
    notes?: string
  },
) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  const protectedDate = typeof input.protectedDate === "string" && input.protectedDate.trim() ? input.protectedDate.trim() : now
  let nextDepositRecord: DepositRecord = {
    ...existingApplication.depositRecord,
    protectionProviderName: input.protectionProviderName.trim(),
    protectionReference: input.protectionReference.trim(),
    protectedAmount: toNonNegativeNumber(input.protectedAmount),
    protectedDate,
  }

  nextDepositRecord = appendDepositHistory(nextDepositRecord, {
    action: "deposit_protection_recorded",
    status: "protected",
    performedBy: user.email,
    timestamp: now,
    notes: input.notes,
  })

  const notificationSent = await sendDepositProtectedNotification({
    toEmail: existingApplication.applicantEmail,
    tenantName: existingApplication.applicantName,
    propertyAddress: existingApplication.propertyAddress,
    providerName: nextDepositRecord.protectionProviderName,
    protectionReference: nextDepositRecord.protectionReference,
    protectedAmount: nextDepositRecord.protectedAmount,
    currency: nextDepositRecord.currency,
    protectedDate,
  })

  const communicationEntry = createDepositCommunicationEntry({
    occurredAt: now,
    subject: "Deposit protection recorded",
    summary: `Deposit protected with ${nextDepositRecord.protectionProviderName}.`,
    recordedByName: user.email,
    target: existingApplication.applicantEmail,
    deliveryStatus: notificationSent ? "sent" : "failed",
    deliveryDetail: notificationSent ? "Deposit protection confirmation sent to tenant." : "Deposit protection confirmation email could not be sent.",
    deliverySentAt: notificationSent ? now : undefined,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
      currentStage: "deposit_protection",
      status: "deposit_protected",
      postMoveInManagement: {
        ...existingApplication.postMoveInManagement,
        communicationEntries: [communicationEntry, ...existingApplication.postMoveInManagement.communicationEntries],
      },
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  return nextApplication
}

export async function setDepositTerminalStatusForApplication(
  user: AuthUser,
  applicationId: string,
  input: {
    status: "returned" | "disputed"
    notes?: string
  },
) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  let nextDepositRecord: DepositRecord = {
    ...existingApplication.depositRecord,
    returnedDate: input.status === "returned" ? now : existingApplication.depositRecord.returnedDate,
  }

  nextDepositRecord = appendDepositHistory(nextDepositRecord, {
    action: input.status === "returned" ? "deposit_returned" : "deposit_disputed",
    status: input.status,
    performedBy: user.email,
    timestamp: now,
    notes: input.notes,
  })

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  return nextApplication
}

export async function uploadDepositDocumentForApplication(
  user: AuthUser,
  applicationId: string,
  category: string,
  file: File,
  replaceDocumentId?: string,
) {
  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const role = getUserRole(user)
  const isReviewer = canReviewTenancyApplications(user)
  const isApplicantOrTenant = role === "applicant" || role === "tenant"

  if (isReviewer) {
    const canAccess = await canAccessApplicationForReviewer(user, existingApplication)

    if (!canAccess) {
      throw new Error("Forbidden")
    }
  } else if (isApplicantOrTenant) {
    if (!canAccessApplicationForApplicantOrTenant(user, existingApplication)) {
      throw new Error("Forbidden")
    }

    if (category !== "payment_receipt") {
      throw new Error("Forbidden")
    }
  } else {
    throw new Error("Forbidden")
  }

  const normalizedCategory = normalizeDepositDocumentCategory(category)
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const upload = await uploadDepositDocument({
    applicationId: existingApplication.id,
    category: normalizedCategory,
    fileName: file.name,
    fileBuffer,
    mimeType: file.type || "application/octet-stream",
  })

  const now = new Date().toISOString()
  const document: DepositDocumentRecord = {
    id: replaceDocumentId || randomUUID(),
    category: normalizedCategory,
    fileName: file.name,
    blobName: upload.blobName,
    url: upload.url,
    contentType: file.type || "application/octet-stream",
    size: upload.size,
    uploadedAt: now,
    uploadedByEmail: user.email,
  }

  const replacedDocument = replaceDocumentId
    ? (existingApplication.depositRecord.documents ?? []).find((candidate) => candidate.id === replaceDocumentId)
    : undefined

  const nextDepositRecord = appendDepositHistory(
    {
      ...existingApplication.depositRecord,
      documents: [
        ...(existingApplication.depositRecord.documents ?? []).filter((candidate) => candidate.id !== replaceDocumentId),
        document,
      ],
    },
    {
      action: "deposit_document_uploaded",
      status: existingApplication.depositRecord.status,
      performedBy: user.email,
      timestamp: now,
      notes: `${normalizedCategory}: ${file.name}`,
    },
  )

  const nextApplication = mergeDepositRecord(
    {
      ...existingApplication,
      updatedAt: now,
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(existingApplication, nextApplication, user)

  if (replacedDocument?.blobName) {
    await deleteDepositDocument(replacedDocument.blobName).catch(() => undefined)
  }

  return {
    application: nextApplication,
    document,
  }
}

export async function getDepositDocumentForApplication(user: AuthUser, applicationId: string, documentId: string) {
  const application = await getApplicationById(applicationId)

  if (!application) {
    return null
  }

  if (canReviewTenancyApplications(user)) {
    const canAccess = await canAccessApplicationForReviewer(user, application)

    if (!canAccess) {
      throw new Error("Forbidden")
    }
  } else if (!canAccessApplicationForApplicantOrTenant(user, application)) {
    throw new Error("Forbidden")
  }

  const document = (application.depositRecord.documents ?? []).find((candidate) => candidate.id === documentId)

  if (!document) {
    return {
      application,
      document: null,
    }
  }

  const download = await downloadDepositDocument(document.blobName)

  return {
    application,
    document,
    download,
  }
}

export async function deleteDepositDocumentForApplication(user: AuthUser, applicationId: string, documentId: string) {
  assertReviewer(user)

  const application = await getApplicationById(applicationId)

  if (!application) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, application)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const existingDocuments = application.depositRecord.documents ?? []
  const removedDocument = existingDocuments.find((candidate) => candidate.id === documentId)

  if (!removedDocument) {
    return {
      application,
      deleted: false,
    }
  }

  const now = new Date().toISOString()
  const nextDepositRecord = appendDepositHistory(
    {
      ...application.depositRecord,
      documents: existingDocuments.filter((candidate) => candidate.id !== documentId),
    },
    {
      action: "deposit_document_deleted",
      status: application.depositRecord.status,
      performedBy: user.email,
      timestamp: now,
      notes: removedDocument.fileName,
    },
  )

  const nextApplication = mergeDepositRecord(
    {
      ...application,
      updatedAt: now,
    },
    nextDepositRecord,
  )

  await persistApplicationWithAudit(application, nextApplication, user)
  await deleteDepositDocument(removedDocument.blobName).catch(() => undefined)

  return {
    application: nextApplication,
    deleted: true,
  }
}
