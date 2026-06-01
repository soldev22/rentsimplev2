import "server-only"

type PropertyDescriptionInput = {
  addressLine1: string
  addressLine2?: string
  city: string
  postcode: string
  type: string
  status: string
  bedrooms?: number
  bathrooms?: number
  monthlyRent?: number
}

function buildShortDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return ""
  }

  const sentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()
  const candidate = sentence || normalized

  return candidate.length <= 160 ? candidate : `${candidate.slice(0, 157).trimEnd()}...`
}

const openAiBaseUrl =
  process.env.OPENAI_BASE_URL?.trim() ||
  process.env.OPENAI_ENDPOINT?.trim() ||
  process.env.AZURE_OPENAI_ENDPOINT?.trim() ||
  ""
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || process.env.AZURE_OPENAI_API_KEY?.trim() || ""
const openAiModel = process.env.OPENAI_MODEL?.trim() || ""
const azureOpenAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim() ?? ""
const azureOpenAiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim() ?? ""
const azureOpenAiApiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-10-21"

type AiRequestConfig = {
  url: string
  headers: HeadersInit
  body: {
    messages: Array<{
      role: "system" | "user"
      content: string
    }>
    temperature: number
    model?: string
    max_tokens?: number
    max_completion_tokens?: number
  }
}

function isAzureOpenAiEndpoint(endpoint: string) {
  return endpoint.includes(".openai.azure.com")
}

function getAiRequestConfig(messages: AiRequestConfig["body"]["messages"]): AiRequestConfig {
  if (azureOpenAiEndpoint && isAzureOpenAiEndpoint(azureOpenAiEndpoint)) {
    if (!openAiApiKey || !azureOpenAiDeployment) {
      throw new Error("AiNotConfigured")
    }

    return {
      url: `${azureOpenAiEndpoint.replace(/\/$/, "")}/openai/deployments/${azureOpenAiDeployment}/chat/completions?api-version=${azureOpenAiApiVersion}`,
      headers: {
        "Content-Type": "application/json",
        "api-key": openAiApiKey,
      },
      body: {
        messages,
        temperature: 0.7,
        max_tokens: 420,
      },
    }
  }

  if (!openAiBaseUrl || !openAiApiKey || !openAiModel) {
    throw new Error("AiNotConfigured")
  }

  return {
    url: `${openAiBaseUrl.replace(/\/$/, "")}/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: {
      model: openAiModel,
      messages,
      temperature: 0.7,
      max_completion_tokens: 420,
    },
  }
}

function normalizeModelText(content: unknown) {
  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "object" && item && "text" in item ? String(item.text) : ""))
      .join("\n")
      .trim()
  }

  return ""
}

function parseGeneratedPropertyDescription(content: string) {
  try {
    const parsed = JSON.parse(content) as {
      shortDescription?: unknown
      longDescription?: unknown
    }

    const shortDescription =
      typeof parsed.shortDescription === "string" ? parsed.shortDescription.trim() : ""
    const longDescription = typeof parsed.longDescription === "string" ? parsed.longDescription.trim() : ""

    if (shortDescription && longDescription) {
      return {
        shortDescription,
        longDescription,
      }
    }
  } catch {
    // Fall back to deriving a strapline from plain-text output if the model does not return valid JSON.
  }

  return {
    shortDescription: buildShortDescription(content),
    longDescription: content,
  }
}

export async function generatePropertyDescription(input: PropertyDescriptionInput) {
  const messages = [
    {
      role: "system" as const,
      content:
        'You write polished UK estate-agent property descriptions with confident, aspirational sales language. Lean into a boujie premium-market tone: elegant, inviting, lifestyle-led, and persuasive without sounding absurd or false. Highlight space, light, finish, flexibility, kerb appeal, convenience, and overall desirability in classic estate-agent style. Return valid JSON only with exactly two string fields: "shortDescription" and "longDescription". "shortDescription" must be a sharp estate-agent strapline of roughly 12 to 24 words in one sentence. "longDescription" must read like a premium listing, around 140 to 220 words across 2 balanced paragraphs. No markdown, no code fences, no extra keys.',
    },
    {
      role: "user" as const,
      content: `Create a rental property description from these facts:\nAddress line 1: ${input.addressLine1}\nAddress line 2: ${input.addressLine2 || "N/A"}\nTown/city: ${input.city}\nPostcode: ${input.postcode}\nProperty type: ${input.type}\nListing status: ${input.status}\nBedrooms: ${input.bedrooms ?? 0}\nBathrooms: ${input.bathrooms ?? 0}\nMonthly rent: GBP ${input.monthlyRent ?? 0}`,
    },
  ]

  const requestConfig = getAiRequestConfig(messages)

  const response = await fetch(requestConfig.url, {
    method: "POST",
    headers: requestConfig.headers,
    body: JSON.stringify(requestConfig.body),
  })

  if (!response.ok) {
    throw new Error("AiRequestFailed")
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown
      }
    }>
  }

  const description = normalizeModelText(payload.choices?.[0]?.message?.content)

  if (!description) {
    throw new Error("AiEmptyResponse")
  }

  return parseGeneratedPropertyDescription(description)
}