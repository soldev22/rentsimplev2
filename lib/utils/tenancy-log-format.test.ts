import { describe, expect, it } from "vitest"

import type { TenancyApplicationRecord } from "@/lib/auth"
import { buildTenancyLogText } from "@/lib/utils/tenancy-log-format"

const application: TenancyApplicationRecord = {
  id: "application-1",
  propertyId: "property-1",
  propertyAddress: "12 Demo Street",
  propertyCity: "London",
  monthlyRent: 1200,
  affordabilityMultiple: 2.5,
  applicantId: "tenant-1",
  applicantEmail: "alex@example.com",
  applicantName: "Alex Tenant",
  currentStage: "post_move_in",
  status: "active_tenant",
  submittedAt: "2026-06-01T09:00:00.000Z",
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-19T10:00:00.000Z",
  applicantProfile: {
    employmentStatus: "employed_full_time",
    annualIncome: 50000,
    moveInDate: "2026-06-15",
    preferredContactMethods: ["email", "sms"],
    hasPets: false,
    petDetails: "",
    smokes: false,
    occupantCount: 1,
    hasAdverseCredit: false,
    adverseCreditDetails: "",
    creditCheckConsentGiven: true,
    creditCheckConsentGivenAt: "2026-06-01T09:00:00.000Z",
    creditCheckConsentVersion: "tenant-credit-check-consent-v1",
  },
  referencingInstruction: {
    providerStatus: "documents_received",
    photoIdReceived: true,
    proofOfAddressReceived: true,
    incomeEvidenceReceived: true,
    employerContactDetails: "Employer",
    previousLandlordContactDetails: "Previous landlord",
    sharePointFileStatus: "created",
    notes: "",
  },
  referencingReport: {
    outcome: "pass",
    completedAt: "2026-06-05T11:00:00.000Z",
    summary: "All clear.",
    checks: {
      identityDocumentVerified: true,
      addressVerified: true,
      fraudMarkersClear: true,
      creditFileReviewed: true,
      creditIssuesClear: true,
      linkedAddressesReviewed: true,
      creditScore: "Good",
      affordabilityVerified: true,
      employmentReferenceVerified: true,
      previousLandlordReferenceVerified: true,
      guarantorRequired: false,
      guarantorVerified: false,
      guarantorAnnualIncome: 0,
      notes: "",
    },
  },
  approvalDecision: {
    outcome: "approved",
    rationale: "Strong application",
    affordabilityCalculation: "3.8x",
    exceptionNotes: "",
    certificateIssuedAt: "2026-06-06T12:00:00.000Z",
  },
  tenancyAgreement: {
    legalFramework: "england_wales",
    tenancyType: "AST",
    rentAmount: 1200,
    rentDueDate: "1st",
    depositAmount: 1200,
    termLengthMonths: 12,
    guarantorDeedRequired: false,
    agreementProvider: "DocuSign",
    agreementReference: "AGR-123",
    agreementSigningUrl: "https://example.com/sign",
    agreementSentForSignature: true,
    agreementSentAt: "2026-06-07T10:00:00.000Z",
    agreementSigned: true,
    agreementSignedAt: "2026-06-09T10:00:00.000Z",
    offerLetter: {
      reference: "OFF-1",
      url: "https://example.com/offer",
      sent: true,
      sentAt: "2026-06-06T13:00:00.000Z",
      signedCopyReceived: false,
      signedCopyReceivedAt: undefined,
    },
    leaseDocument: {
      reference: "LEASE-1",
      url: "https://example.com/lease",
      sent: true,
      sentAt: "2026-06-07T10:00:00.000Z",
      signedCopyReceived: true,
      signedCopyReceivedAt: "2026-06-09T10:00:00.000Z",
    },
    supportingLegalDocuments: {
      reference: "LEGAL-1",
      url: "https://example.com/legal",
      sent: true,
      sentAt: "2026-06-07T11:00:00.000Z",
      signedCopyReceived: false,
      signedCopyReceivedAt: undefined,
      summary: "How to Rent and deposit pack",
    },
  },
  applicantChecklist: {
    applicationInformationConfirmed: true,
    moveInFundsConfirmed: true,
    agreementTermsAccepted: true,
    documentsReadyConfirmed: true,
    signedFullName: "Alex Tenant",
    signedAt: "2026-06-10T10:00:00.000Z",
  },
  preMoveInCompliance: {
    epcIssued: true,
    gasSafetyIssued: true,
    eicrIssued: true,
    howToRentIssued: true,
    depositLeafletIssued: true,
    checkInScheduled: true,
    inventoryPrepared: true,
  },
  moveInChecklist: {
    inspectionCompleted: true,
    inventoryCompletedWithPhotos: true,
    meterReadingsRecorded: true,
    smokeAlarmsTested: true,
    keysIssued: true,
    keyNumbers: "A1",
    tenantContactConfirmed: true,
  },
  depositProtection: {
    protectedWithinThirtyDays: true,
    prescribedInformationIssued: true,
    certificateUploaded: true,
    certificateReference: "DEP-1",
  },
  postMoveInManagement: {
    firstInspectionDate: "2026-07-01T12:00:00.000Z",
    maintenanceLogNotes: "Minor snagging logged.",
    communicationLogNotes: "",
    communicationEntries: [
      {
        id: "comm-1",
        occurredAt: "2026-06-12T08:00:00.000Z",
        channel: "email",
        direction: "outbound",
        subject: "Welcome",
        summary: "Sent welcome email and move-in details.",
        recordedByName: "Admin User",
        notification: {
          channel: "email",
          target: "alex@example.com",
          status: "sent",
          attemptedAt: "2026-06-12T08:00:00.000Z",
          sentAt: "2026-06-12T08:01:00.000Z",
          fromAddress: "agent@example.com",
          replyTo: "agent@example.com",
          copiedTo: ["landlord@example.com"],
          detail: "Email sent directly to the tenant from the managing agent and copied to the landlord.",
        },
      },
    ],
  },
}

describe("buildTenancyLogText", () => {
  it("includes the communication timeline and core tenancy details", () => {
    const text = buildTenancyLogText(application)

    expect(text).toContain("RentSimple Tenancy Log")
    expect(text).toContain("Tenant: Alex Tenant")
    expect(text).toContain("Communication: Welcome")
    expect(text).toContain("Sent welcome email and move-in details.")
    expect(text).toContain("Decision recorded")
    expect(text).toContain("Sent from: agent@example.com")
    expect(text).toContain("Copied to: landlord@example.com")
    expect(text).toContain("Routing detail: Email sent directly to the tenant from the managing agent and copied to the landlord.")
  })
})