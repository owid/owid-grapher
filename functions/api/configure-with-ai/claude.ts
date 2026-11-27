import { Model } from "./viewfinder.js"

// The Messages API call shared by the "Configure with AI" routes

export interface ClaudeResult {
    text: string
    stopReason: string
    model: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
}

export async function callClaude(
    apiKey: string,
    model: Model,
    prompt: { cached: string; request: string }
): Promise<ClaudeResult> {
    // Server-side fallback on a refusal isn't offered for Haiku
    const useFallbacks = model !== "claude-haiku-5-5"
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            ...(useFallbacks
                ? { "anthropic-beta": "server-side-fallback-2026-07-01" }
                : {}),
        },
        body: JSON.stringify({
            model,
            max_tokens: 16000,
            output_config: { effort: "low" },
            ...(useFallbacks ? { fallbacks: "default" } : {}),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt.cached,
                            cache_control: { type: "ephemeral" },
                        },
                        { type: "text", text: prompt.request },
                    ],
                },
            ],
        }),
    })
    if (!response.ok)
        throw new Error(
            `Anthropic API ${response.status}: ${(await response.text()).slice(0, 500)}`
        )
    const body: {
        content: { type: string; text?: string }[]
        stop_reason: string
        model: string
        usage: {
            input_tokens: number
            output_tokens: number
            cache_read_input_tokens?: number
            cache_creation_input_tokens?: number
        }
    } = await response.json()
    return {
        text: body.content
            .filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join(""),
        stopReason: body.stop_reason,
        model: body.model,
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
        cacheReadTokens: body.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: body.usage.cache_creation_input_tokens ?? 0,
    }
}
