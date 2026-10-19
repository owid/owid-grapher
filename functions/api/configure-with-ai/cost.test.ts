import { describe, it, expect } from "vitest"
import { costOf, costsByModel } from "./cost.js"

// A typical run: a cached prompt of ~9,400 tokens, a short request and reply
const usage = {
    inputTokens: 88,
    cacheReadTokens: 9412,
    cacheWriteTokens: 0,
    outputTokens: 250,
}

describe(costOf, () => {
    it("prices cached and uncached input and output separately", () => {
        // Haiku 5.5: $0.10 input, $0.01 cache read, $0.50 output per MTok
        expect(costOf(usage, "claude-haiku-5-5")).toBeCloseTo(
            (88 * 0.1 + 9412 * 0.01 + 250 * 0.5) / 1e6,
            9
        )
    })

    it("compares the same tokens on Haiku and Sonnet", () => {
        const costs = costsByModel(usage)
        expect(costs["claude-sonnet-5-5"]).toBeGreaterThan(
            10 * costs["claude-haiku-5-5"]!
        )
    })
})
