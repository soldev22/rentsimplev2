import "server-only"

import type { PropertyImageModerationScores } from "@/lib/auth"

const contentSafetyEndpoint = process.env.AZURE_CONTENT_SAFETY_ENDPOINT?.trim() ?? ""
const contentSafetyKey = process.env.AZURE_CONTENT_SAFETY_KEY?.trim() ?? ""
const contentSafetyApiVersion = process.env.AZURE_CONTENT_SAFETY_API_VERSION?.trim() || "2024-09-01"

const thresholds: PropertyImageModerationScores = {
  hate: Number(process.env.AZURE_CONTENT_SAFETY_HATE_THRESHOLD ?? 4),
  selfHarm: Number(process.env.AZURE_CONTENT_SAFETY_SELF_HARM_THRESHOLD ?? 4),
  sexual: Number(process.env.AZURE_CONTENT_SAFETY_SEXUAL_THRESHOLD ?? 2),
  violence: Number(process.env.AZURE_CONTENT_SAFETY_VIOLENCE_THRESHOLD ?? 2),
}

function normalizeSeverity(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function parseCategory(category: string) {
  switch (category.toLowerCase()) {
    case "hate":
      return "hate"
    case "selfharm":
    case "self_harm":
    case "self-harm":
      return "selfHarm"
    case "sexual":
      return "sexual"
    case "violence":
      return "violence"
    default:
      return null
  }
}

function getContentSafetyUrl() {
  if (!contentSafetyEndpoint || !contentSafetyKey) {
    throw new Error("ImageModerationNotConfigured")
  }

  return `${contentSafetyEndpoint.replace(/\/$/, "")}/contentsafety/image:analyze?api-version=${contentSafetyApiVersion}`
}

export async function moderatePropertyImageUpload(data: Buffer) {
  const response = await fetch(getContentSafetyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": contentSafetyKey,
    },
    body: JSON.stringify({
      image: {
        content: data.toString("base64"),
      },
      categories: ["Hate", "SelfHarm", "Sexual", "Violence"],
      outputType: "FourSeverityLevels",
    }),
  })

  if (!response.ok) {
    throw new Error("ImageModerationRequestFailed")
  }

  const payload = (await response.json()) as {
    categoriesAnalysis?: Array<{
      category?: string
      severity?: number
    }>
  }

  const scores: PropertyImageModerationScores = {
    hate: 0,
    selfHarm: 0,
    sexual: 0,
    violence: 0,
  }

  for (const categoryResult of payload.categoriesAnalysis ?? []) {
    const key = parseCategory(categoryResult.category ?? "")

    if (!key) {
      continue
    }

    scores[key] = normalizeSeverity(categoryResult.severity)
  }

  const blockedCategories = Object.entries(scores)
    .filter(([key, severity]) => severity >= thresholds[key as keyof PropertyImageModerationScores])
    .map(([key]) => key)

  return {
    scores,
    allowed: blockedCategories.length === 0,
    reason:
      blockedCategories.length === 0
        ? "Awaiting admin approval."
        : `Blocked by image moderation: ${blockedCategories.join(", ")}.`,
  }
}