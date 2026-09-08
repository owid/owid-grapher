import { expect, it, describe } from "vitest"

import {
    buildPrompt,
    describeChartState,
    buildEngineUrl,
    buildCsvUrl,
    buildFullCsvUrl,
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

    it("ends on the visitor's question", () => {
        const lines = prompt.trimEnd().split("\n")
        expect(lines[lines.length - 1]).toBe(
            "My question: Why has this fallen so fast?"
        )
        // and the guidance comes before it, so the ask is what's freshest
        expect(prompt.indexOf("When you answer:")).toBeLessThan(
            prompt.indexOf("My question:")
        )
    })

    it("nudges towards the OWID skills afterwards", () => {
        expect(prompt).toContain("https://github.com/owid/skills")
        expect(prompt).toContain("Afterwards")
    })

    it("keeps the skills nudge even when the prompt has to shrink", () => {
        const slugUrl = `${OWID_PUBLIC_GRAPHER_URL}/share-of-population-living-in-cities-towns-and-villages`
        const queryStr =
            "?country=~NGA~IND~USA~CHN~BRA~ZAF~IDN&time=1960..latest&tab=chart"
        const worst = buildPrompt({
            title: "Share of population living in cities, towns and villages",
            pageUrl: `${slugUrl}${queryStr}`,
            slugUrl,
            queryStr,
            stateSummary: describeChartState(queryStr),
            question:
                "How has the urban share changed in each of these countries since 1960?",
        })
        expect(worst).toContain("https://github.com/owid/skills")
    })

    it("asks for a short, data-led answer", () => {
        expect(prompt).toContain("keep it short")
        expect(prompt).toContain("compact table")
    })

    it("no longer asks the assistant to embed our chart image", () => {
        expect(prompt).not.toContain(".png")
    })

    it("welcomes relevant Our World in Data links but forbids inventing them", () => {
        expect(prompt).toContain("related research and charts")
        expect(prompt).toContain("Don't invent URLs")
    })

    it("carries the visitor's question and on-screen state", () => {
        expect(prompt).toContain("My question: Why has this fallen so fast?")
        expect(prompt).toContain("I have selected: NGA.")
    })

    it("tells the assistant not to fill gaps with estimates", () => {
        expect(prompt).toContain("rather than estimating")
    })

    it("stays inside a safe URL length for a realistic worst case", () => {
        // Long slug, several entities, a time range and a wordy question —
        // roughly the largest prompt a visitor can generate. Some WAFs get
        // unhappy well before browsers do, so keep the whole URL under ~2 KB.
        const slugUrl = `${OWID_PUBLIC_GRAPHER_URL}/share-of-population-living-in-cities-towns-and-villages`
        const queryStr =
            "?country=~NGA~IND~USA~CHN~BRA~ZAF~IDN&time=1960..latest&tab=chart"
        const worst = buildPrompt({
            title: "Share of population living in cities, towns and villages",
            pageUrl: `${slugUrl}${queryStr}`,
            slugUrl,
            queryStr,
            stateSummary: describeChartState(queryStr),
            question:
                "How has the urban share changed in each of these countries since 1960, and which of them urbanised fastest over that period?",
        })
        // A realistic worst case fits without shedding anything.
        expect(encodeURIComponent(worst).length).toBeLessThan(3000)
        expect(worst).toContain("csvType=filtered")
        expect(worst).toContain("csvType=full")
        expect(worst).toContain(".metadata.json")
        expect(worst).toContain("Lead with the data")
        expect(worst).toContain(
            "which of them urbanised fastest over that period?"
        )
    })

    it("truncates the question rather than let the URL be clipped", () => {
        const slugUrl = `${OWID_PUBLIC_GRAPHER_URL}/child-mortality`
        const out = buildPrompt({
            title: "Child mortality rate",
            pageUrl: slugUrl,
            slugUrl,
            queryStr: "",
            question: "why ".repeat(500),
        })
        expect(encodeURIComponent(out).length).toBeLessThanOrEqual(3000)
        expect(out).toContain("\u2026")
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
    it("offers the full export as a fallback, ignoring selection", () => {
        expect(buildFullCsvUrl(SLUG_URL)).toBe(`${SLUG_URL}.csv?csvType=full`)
    })

    it("offers both exports and says which to prefer", () => {
        const p = buildPrompt({
            title: "Child mortality rate",
            pageUrl: SLUG_URL,
            slugUrl: SLUG_URL,
            queryStr: "?country=~NGA",
            question: "Explain this.",
        })
        expect(p).toContain("csvType=filtered")
        expect(p).toContain("csvType=full")
        expect(p).toContain("prefer the first")
    })

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
        // The skills repo is the one deliberate exception; everything else
        // must be on the public site, never a staging or localhost origin.
        const OWID_SKILLS_REPO = "https://github.com/owid/skills"
        for (const url of prompt.match(/https?:\/\/[^\s)]+/g) ?? []) {
            if (url === OWID_SKILLS_REPO) continue
            expect(url.startsWith("https://ourworldindata.org/")).toBe(true)
        }
    })
})
