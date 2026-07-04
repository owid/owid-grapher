// Environment hosts for the assistant's web/code/summaries tools: URL
// fetching goes through the admin server's proxy (a page can't fetch
// cross-origin like the MV3 extension could), web search reuses the user's
// Google key via Gemini grounding, and the summarizer picks the first cheap
// model whose provider has a stored API key — all patterns from the
// gdocs-chrome-extension, re-hosted.

import { completeSimple, getModels, type Model } from "@earendil-works/pi-ai"
import { Admin } from "../../Admin.js"
import { blockedFetchReason } from "../../../adminShared/urlFetchGuard.js"
import {
    geminiGroundedSearch,
    type GroundingFetch,
    type WebFetchResult,
    type WebHost,
} from "./webTools.js"
import { createLocalCodeHost } from "./localCodeHost.js"
import type { CodeHost } from "./codeTools.js"
import type { Summarizer } from "./summaries.js"
import { assistantProviderKeys, assistantSettings } from "./storage.js"

async function proxyFetch(admin: Admin, url: string): Promise<WebFetchResult> {
    const reason = blockedFetchReason(url)
    if (reason) throw new Error(reason)
    const response = await admin.rawRequest(
        `/api/assistant/fetchUrl?url=${encodeURIComponent(url)}`,
        undefined,
        "GET"
    )
    if (!response.ok) {
        let message = `The fetch proxy returned HTTP ${response.status}.`
        try {
            const parsed = (await response.json()) as {
                error?: { message?: string }
            }
            if (parsed.error?.message) message = parsed.error.message
        } catch {
            // keep the generic message
        }
        throw new Error(message)
    }
    return (await response.json()) as WebFetchResult
}

export function createAssistantWebHost(admin: Admin): WebHost {
    const groundingFetch: GroundingFetch = (url, init) => fetch(url, init)
    return {
        search: async (query) => {
            const key = await assistantProviderKeys.get("google")
            if (typeof key !== "string" || key === "" || key.startsWith("{"))
                throw new Error(
                    "No Google API key found — add your Google (Gemini) key via the model selector. Web search reuses it via Gemini grounding."
                )
            return geminiGroundedSearch(
                groundingFetch,
                key,
                "gemini-2.5-flash",
                query
            )
        },
        fetch: (url) => proxyFetch(admin, url),
    }
}

export function createAssistantCodeHost(admin: Admin): CodeHost {
    return createLocalCodeHost({ fetch: (url) => proxyFetch(admin, url) })
}

// Cheap-model summarizer: first candidate whose provider has an API key.
const SUMMARIZER_CANDIDATES: { provider: string; modelId: string }[] = [
    { provider: "google", modelId: "gemini-2.0-flash-lite" },
    { provider: "openai", modelId: "gpt-5-nano" },
    { provider: "anthropic", modelId: "claude-haiku-4-5" },
]

async function pickSummarizerModel(): Promise<{
    model: Model<never>
    apiKey: string
} | null> {
    const configured = await assistantSettings.get<{
        provider: string
        modelId: string
    }>("summarizerModel")
    const candidates = configured
        ? [configured, ...SUMMARIZER_CANDIDATES]
        : SUMMARIZER_CANDIDATES
    for (const candidate of candidates) {
        let models: Model<never>[]
        try {
            models = getModels(
                candidate.provider as Parameters<typeof getModels>[0]
            ) as Model<never>[]
        } catch {
            continue
        }
        const model = models.find((m) => m.id === candidate.modelId)
        if (!model) continue
        const key = await assistantProviderKeys.get(candidate.provider)
        if (typeof key === "string" && key !== "" && !key.startsWith("{"))
            return { model, apiKey: key }
    }
    return null
}

export function createAssistantSummarizer(): Summarizer {
    return {
        complete: async (systemPrompt, userPrompt) => {
            const picked = await pickSummarizerModel()
            if (!picked)
                throw new Error(
                    "No summarizer model available — add an API key for Google, OpenAI, or Anthropic first."
                )
            const reply = await completeSimple(
                picked.model as Parameters<typeof completeSimple>[0],
                {
                    systemPrompt,
                    messages: [
                        {
                            role: "user",
                            content: userPrompt,
                            timestamp: Date.now(),
                        },
                    ],
                },
                { apiKey: picked.apiKey }
            )
            return reply.content
                .filter(
                    (c): c is { type: "text"; text: string } =>
                        c.type === "text"
                )
                .map((c) => c.text)
                .join("\n")
        },
    }
}
