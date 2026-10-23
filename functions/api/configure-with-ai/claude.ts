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
    /** See TokenUsage in cost.ts */
    firstCallCacheReadTokens?: number
    /** Each API call's stop reason and block types, for debugging */
    rounds: string[]
}

/** A tool the model can call; `run` gets the model's input and returns the result */
export interface ClaudeTool {
    name: string
    description: string
    input_schema: Record<string, unknown>
    run: (input: unknown) => Promise<unknown>
}

/** Rounds of tool calls before the model has to answer */
const MAX_TOOL_ROUNDS = 3

/** A block of the model's reply: text, a tool call, or one we pass back as is */
interface ContentBlock {
    type: string
    text?: string
    /** Set on tool_use blocks */
    id?: string
    name?: string
    input?: unknown
}

interface MessagesResponse {
    content: ContentBlock[]
    stop_reason: string
    model: string
    usage: {
        input_tokens: number
        output_tokens: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
    }
}

export async function callClaude(
    apiKey: string,
    model: Model,
    prompt: { cached: string; request: string },
    tools: ClaudeTool[] = []
): Promise<ClaudeResult> {
    // Server-side fallback on a refusal isn't offered for Haiku
    const useFallbacks = model !== "claude-haiku-5-5"
    const messages: { role: "user" | "assistant"; content: unknown[] }[] = [
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
    ]
    const result: ClaudeResult = {
        text: "",
        stopReason: "",
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        rounds: [],
    }
    const toolDefinitions = tools.map(({ run: _run, ...tool }) => tool)
    let hasAskedForReply = false
    for (let round = 0; ; round++) {
        const body = await postMessages(apiKey, useFallbacks, {
            model,
            max_tokens: 16000,
            output_config: { effort: "low" },
            ...(useFallbacks ? { fallbacks: "default" } : {}),
            ...(tools.length
                ? {
                      tools: toolDefinitions,
                      // The last round has to answer rather than search again
                      ...(round >= MAX_TOOL_ROUNDS
                          ? { tool_choice: { type: "none" } }
                          : {}),
                  }
                : {}),
            messages,
        })
        result.stopReason = body.stop_reason
        result.model = body.model
        result.inputTokens += body.usage.input_tokens
        result.outputTokens += body.usage.output_tokens
        result.cacheReadTokens += body.usage.cache_read_input_tokens ?? 0
        if (round === 0)
            result.firstCallCacheReadTokens =
                body.usage.cache_read_input_tokens ?? 0
        result.cacheWriteTokens += body.usage.cache_creation_input_tokens ?? 0
        result.text = body.content
            .filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join("")
        result.rounds.push(
            `${body.stop_reason}: ${body.content.map((b) => b.type).join(", ")}`
        )

        const calls = body.content.filter((block) => block.type === "tool_use")
        if (body.stop_reason !== "tool_use" || !calls.length) {
            // After searching, the model sometimes ends its turn without
            // writing the reply; ask for it once
            const isEmptyAfterSearch =
                round > 0 && body.stop_reason === "end_turn" && !result.text
            if (!isEmptyAfterSearch || hasAskedForReply) return result
            hasAskedForReply = true
            if (body.content.length)
                messages.push({ role: "assistant", content: body.content })
            messages.push({
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Reply now with only the JSON object described above.",
                    },
                ],
            })
            continue
        }
        const results = await Promise.all(
            calls.map(async (call) => {
                const tool = tools.find((t) => t.name === call.name)
                let content = `There is no tool named ${call.name}.`
                let isError = !tool
                if (tool)
                    try {
                        content = JSON.stringify(await tool.run(call.input))
                    } catch (error) {
                        console.error(error)
                        content = "The tool failed."
                        isError = true
                    }
                return {
                    type: "tool_result",
                    tool_use_id: call.id,
                    content,
                    ...(isError ? { is_error: true } : {}),
                }
            })
        )
        messages.push(
            { role: "assistant", content: body.content },
            { role: "user", content: results }
        )
    }
}

async function postMessages(
    apiKey: string,
    useFallbacks: boolean,
    body: Record<string, unknown>
): Promise<MessagesResponse> {
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
        body: JSON.stringify(body),
    })
    if (!response.ok)
        throw new Error(
            `Anthropic API ${response.status}: ${(await response.text()).slice(0, 500)}`
        )
    return response.json()
}
