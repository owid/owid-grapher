import Anthropic from "@anthropic-ai/sdk"
import { JsonError } from "@ourworldindata/types"
import { ANTHROPIC_API_KEY } from "../settings/serverSettings.js"

/** An Anthropic API client, or a clear error when no key is configured. */
export function getAnthropicClient(): Anthropic {
    if (!ANTHROPIC_API_KEY)
        throw new JsonError("No ANTHROPIC_API_KEY env found", 500)
    return new Anthropic({ apiKey: ANTHROPIC_API_KEY })
}

/**
 * The text of a finished response, or null when the model didn't finish its
 * answer (a refusal, or hitting max_tokens). A response can begin with thinking
 * blocks, so the answer is read from its text blocks.
 */
export function responseText(message: Anthropic.Message): string | null {
    if (message.stop_reason !== "end_turn") return null
    const textBlocks = message.content.filter((block) => block.type === "text")
    if (!textBlocks.length) return null
    return textBlocks.map((block) => block.text).join("")
}
