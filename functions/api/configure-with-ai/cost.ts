import { calcPrice } from "@pydantic/genai-prices"
import { Model } from "./viewfinder.js"

// What a run cost, in USD, from the price data bundled with genai-prices

export interface TokenUsage {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
}

/** The run's tokens priced on `model`, or null if the price data doesn't have it */
export function costOf(usage: TokenUsage, model: Model): number | null {
    const price = calcPrice(
        {
            // genai-prices counts cached tokens as part of the input
            input_tokens:
                usage.inputTokens +
                usage.cacheReadTokens +
                usage.cacheWriteTokens,
            cache_read_tokens: usage.cacheReadTokens,
            cache_write_tokens: usage.cacheWriteTokens,
            output_tokens: usage.outputTokens,
        },
        model,
        { providerId: "anthropic" }
    )
    return price?.total_price ?? null
}

/** The same tokens priced on each of Haiku and Sonnet, to compare them */
export function costsByModel(
    usage: TokenUsage
): Record<"claude-haiku-5-5" | "claude-sonnet-5-5", number | null> {
    return {
        "claude-haiku-5-5": costOf(usage, "claude-haiku-5-5"),
        "claude-sonnet-5-5": costOf(usage, "claude-sonnet-5-5"),
    }
}
