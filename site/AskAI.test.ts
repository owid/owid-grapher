import { expect, it, describe } from "vitest"

import {
    buildPrompt,
    describeChartState,
    buildEngineUrl,
    buildCsvUrl,
    OWID_PUBLIC_GRAPHER_URL,
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
        queryStr: "?country=~NGA",
        stateSummary: "I have selected: NGA.",
        question: "Why has this fallen so fast?",
    })

    it("points the assistant at the machine-readable sources", () => {
        expect(prompt).toContain(`${SLUG_URL}.metadata.json`)
        expect(prompt).toContain(`${SLUG_URL}.csv?csvType=filtered`)
    })

    it("asks for a short, data-led answer", () => {
        expect(prompt).toContain("keep it short")
        expect(prompt).toContain("compact table")
    })

    it("no longer asks the assistant to embed our chart image", () => {
        expect(prompt).not.toContain(".png")
    })

    it("forbids inventing Our World in Data URLs", () => {
        expect(prompt).toContain("Don't construct other URLs")
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
            queryStr: "",
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

describe("data and image URLs", () => {
    it("always requests the filtered CSV, even with no selection", () => {
        expect(buildCsvUrl(SLUG_URL, "")).toBe(
            `${SLUG_URL}.csv?csvType=filtered`
        )
    })

    it("carries the visitor's selection into the CSV", () => {
        expect(buildCsvUrl(SLUG_URL, "?country=~NGA~IND&time=2000..2020")).toBe(
            `${SLUG_URL}.csv?csvType=filtered&country=%7ENGA%7EIND&time=2000..2020`
        )
    })

    it("ignores params the grapher endpoints don't understand", () => {
        expect(buildCsvUrl(SLUG_URL, "?askai=v5&utm_source=x")).toBe(
            `${SLUG_URL}.csv?csvType=filtered`
        )
    })
})

describe("public origin", () => {
    // Staging runs on an internal Tailscale host and dev on localhost. Neither
    // is reachable from Claude or ChatGPT, so every URL we hand an assistant
    // has to be the public one regardless of environment.
    it("points at ourworldindata.org", () => {
        expect(OWID_PUBLIC_GRAPHER_URL).toBe(
            "https://ourworldindata.org/grapher"
        )
    })

    it("never emits a staging or localhost URL in the prompt", () => {
        const slugUrl = `${OWID_PUBLIC_GRAPHER_URL}/child-mortality`
        const prompt = buildPrompt({
            title: "Child mortality rate",
            pageUrl: `${slugUrl}?country=~NGA`,
            slugUrl,
            queryStr: "?country=~NGA",
            question: "Explain this.",
        })
        for (const url of prompt.match(/https?:\/\/[^\s)]+/g) ?? []) {
            expect(url.startsWith("https://ourworldindata.org/")).toBe(true)
        }
    })
})
