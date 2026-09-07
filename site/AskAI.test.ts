import { expect, it, describe } from "vitest"

import {
    buildPrompt,
    describeChartState,
    buildEngineUrl,
} from "./askAiPrompt.js"

const SLUG_URL = "https://ourworldindata.org/grapher/child-mortality"

describe("chart state summary", () => {
    it("returns undefined when the chart is in its default state", () => {
        expect(describeChartState("")).toBeUndefined()
        expect(describeChartState("?v=1")).toBeUndefined()
    })

    it("names the selected entities", () => {
        expect(describeChartState("?country=~NGA~IND")).toBe(
            "I have selected: NGA, IND."
        )
    })

    it("reads a time range and tab", () => {
        expect(describeChartState("?time=1990..latest&tab=map")).toBe(
            "I'm looking at the period 1990 to latest. I'm on the \"map\" view."
        )
    })
})

describe("prompt construction", () => {
    const prompt = buildPrompt({
        title: "Child mortality rate",
        pageUrl: `${SLUG_URL}?country=~NGA`,
        slugUrl: SLUG_URL,
        stateSummary: "I have selected: NGA.",
        question: "Why has this fallen so fast?",
    })

    it("points the assistant at the machine-readable sources", () => {
        expect(prompt).toContain(`${SLUG_URL}.metadata.json`)
        expect(prompt).toContain(`${SLUG_URL}.csv`)
    })

    it("carries the visitor's question and on-screen state", () => {
        expect(prompt).toContain("My question: Why has this fallen so fast?")
        expect(prompt).toContain("I have selected: NGA.")
    })

    it("tells the assistant not to fill gaps with estimates", () => {
        expect(prompt).toContain("rather than estimating")
    })

    it("stays well inside a safe URL length once encoded", () => {
        expect(encodeURIComponent(prompt).length).toBeLessThan(1800)
    })

    it("omits the state line when the chart is untouched", () => {
        const bare = buildPrompt({
            title: "Child mortality rate",
            pageUrl: SLUG_URL,
            slugUrl: SLUG_URL,
            question: "Explain this.",
        })
        expect(bare).not.toContain("I have selected")
    })
})

describe("engine deep links", () => {
    it("encodes the prompt into each engine's query param", () => {
        expect(buildEngineUrl("chatgpt", "a b&c")).toBe(
            "https://chatgpt.com/?q=a%20b%26c"
        )
        expect(buildEngineUrl("claude", "a b&c")).toBe(
            "https://claude.ai/new?q=a%20b%26c"
        )
    })
})
