import { calcPrice } from "@pydantic/genai-prices"
import { Model } from "./viewfinder.js"

// What a run cost, in USD, from the price data bundled with genai-prices

export interface TokenUsage {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    /**
     * The cache reads of the first API call, when a run makes several (tool
     * calls). Later calls read the cache the first one wrote either way.
     */
    firstCallCacheReadTokens?: number
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

/**
 * The run as the first question on its chart: the prompt cache is written
 * rather than read. Readers spread across many charts mostly arrive like this,
 * so it's the figure to budget with.
 */
export function asFirstQuestion(usage: TokenUsage): TokenUsage {
    const written = usage.firstCallCacheReadTokens ?? usage.cacheReadTokens
    return {
        ...usage,
        cacheReadTokens: usage.cacheReadTokens - written,
        cacheWriteTokens: usage.cacheWriteTokens + written,
    }
}

export interface Costs {
    /** As this run happened */
    asRun: number | null
    /** As the first question on the chart */
    firstQuestion: number | null
}

const costs = (usage: TokenUsage, model: Model): Costs => ({
    asRun: costOf(usage, model),
    firstQuestion: costOf(asFirstQuestion(usage), model),
})

/** The same tokens priced on each of Haiku and Sonnet, to compare them */
export function costsByModel(
    usage: TokenUsage
): Record<"claude-haiku-5-5" | "claude-sonnet-5-5", Costs> {
    return {
        "claude-haiku-5-5": costs(usage, "claude-haiku-5-5"),
        "claude-sonnet-5-5": costs(usage, "claude-sonnet-5-5"),
    }
}
