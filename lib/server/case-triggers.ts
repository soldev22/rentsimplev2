/**
 * Auto-case creation trigger for tenant communications
 * Monitors for keywords that indicate maintenance, complaints, or issues
 */

import { createPropertyCase } from "@/lib/server/cases"
import { getCasesByType } from "@/lib/server/cases"
import type { AuthUser, CaseType, PropertyRecord } from "@/lib/auth"

type CaseKeywordMap = {
  keywords: string[]
  caseType: CaseType
  titleTemplate: string
}

const CASE_TRIGGERS: CaseKeywordMap[] = [
  {
    keywords: ["damp", "mould", "mold", "dampness", "condensation", "moisture", "black spot"],
    caseType: "damp",
    titleTemplate: "Tenant Report: Damp & Mould",
  },
  {
    keywords: ["flood", "flooding", "water damage", "leak", "leaking", "wet", "soaked"],
    caseType: "flood",
    titleTemplate: "Tenant Report: Flood or Water Damage",
  },
  {
    keywords: ["repair", "broken", "damage", "fix", "maintenance", "issue", "problem", "malfunction"],
    caseType: "maintenance_request",
    titleTemplate: "Tenant Maintenance Request",
  },
  {
    keywords: ["complaint", "unhappy", "dissatisfied", "upset", "frustrated", "concerned", "worried"],
    caseType: "complaint",
    titleTemplate: "Tenant Complaint",
  },
  {
    keywords: ["rent", "payment", "overdue", "late", "arrears", "behind", "dispute"],
    caseType: "rent_dispute",
    titleTemplate: "Potential Rent Dispute",
  },
]

/**
 * Check if a communication text contains any case-triggering keywords
 * Returns the case type if a match is found
 */
export function detectCaseKeyword(text: string): CaseType | null {
  const lowerText = text.toLowerCase()

  for (const trigger of CASE_TRIGGERS) {
    if (trigger.keywords.some((keyword) => lowerText.includes(keyword))) {
      return trigger.caseType
    }
  }

  return null
}

/**
 * Auto-create a property case if communication contains triggering keywords
 * Returns the created case or null if no trigger was detected
 */
export async function autoCreateCaseFromCommunication(
  user: AuthUser,
  property: PropertyRecord,
  communicationText: string,
  tenancyId?: string,
): Promise<string | null> {
  const caseType = detectCaseKeyword(communicationText)
  if (!caseType) return null

  // Check if a case of this type already exists
  const existingCases = await getCasesByType(property.id, caseType)
  if (existingCases.length > 0) {
    // Don't auto-create duplicate cases
    return null
  }

  // Find the trigger to get the title template
  const trigger = CASE_TRIGGERS.find((t) => t.caseType === caseType)
  if (!trigger) return null

  const title = trigger.titleTemplate
  const description = `Auto-created from tenant communication. Message excerpt: "${communicationText.slice(0, 200)}..."`

  try {
    const case_ = await createPropertyCase(user, property.id, caseType, title, description, tenancyId)
    return case_.id
  } catch (error) {
    console.error("Error auto-creating case:", error)
    return null
  }
}
