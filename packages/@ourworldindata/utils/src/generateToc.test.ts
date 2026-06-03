import { expect, it, describe } from "vitest"
import { generateSidebarToc, generateInlineToc } from "./generateToc.js"
import {
    BlockSize,
    EnrichedBlockChart,
    EnrichedBlockHeading,
    EnrichedBlockNarrativeChart,
    EXPLORE_DATA_SECTION_ID,
    FEATURED_DATA_INSIGHTS_ID,
    OwidEnrichedGdocBlock,
    Span,
} from "@ourworldindata/types"

const span = (text: string): Span => ({
    spanType: "span-simple-text",
    text,
})
const heading = (
    level: number,
    text: string,
    supertitle?: string
): EnrichedBlockHeading => ({
    type: "heading",
    level,
    text: [span(text)],
    ...(supertitle ? { supertitle: [span(supertitle)] } : {}),
    parseErrors: [],
})
const chart = (
    url: string,
    visibility?: EnrichedBlockChart["visibility"]
): EnrichedBlockChart => ({
    type: "chart",
    url,
    size: BlockSize.Wide,
    ...(visibility ? { visibility } : {}),
    parseErrors: [],
})
const narrativeChart = (name: string): EnrichedBlockNarrativeChart => ({
    type: "narrative-chart",
    name,
    size: BlockSize.Wide,
    parseErrors: [],
})

describe(generateSidebarToc, () => {
    it("groups chart bullets under their H1 section and drops sub-H1 headings", () => {
        const sections = generateSidebarToc([
            heading(1, "Life expectancy"),
            chart("https://ourworldindata.org/grapher/life-expectancy"),
            heading(2, "By country"),
        ])
        expect(sections).toEqual([
            {
                heading: {
                    level: 1,
                    text: "Life expectancy",
                    slug: "life-expectancy",
                },
                charts: [
                    {
                        kind: "chart",
                        url: "https://ourworldindata.org/grapher/life-expectancy",
                        anchorId: "chart-life-expectancy",
                    },
                ],
            },
        ])
    })

    it("slugs an H1 section from its text only (matching the rendered <h1> id) and keeps the supertitle as a field", () => {
        // A rendered <h1>'s id is text only, so the section slug must not fold
        // in the supertitle or the link would target a nonexistent anchor.
        const [section] = generateSidebarToc([heading(1, "Title", "Super")])
        expect(section.heading).toEqual({
            level: 1,
            text: "Title",
            slug: "title",
            supertitle: "Super",
        })
    })

    it("disambiguates the same chart across non-adjacent sections", () => {
        const first = chart("https://ourworldindata.org/grapher/median-age")
        const second = chart("https://ourworldindata.org/grapher/median-age")
        const sections = generateSidebarToc([
            heading(1, "A"),
            first,
            heading(1, "B"),
            second,
        ])
        expect(first.anchorId).toBe("chart-median-age")
        expect(second.anchorId).toBe("chart-median-age-2")
        expect(sections[0].charts.map((c) => c.anchorId)).toEqual([
            "chart-median-age",
        ])
        expect(sections[1].charts.map((c) => c.anchorId)).toEqual([
            "chart-median-age-2",
        ])
    })

    it("collapses adjacent duplicate charts to one bullet but keeps distinct anchors", () => {
        const first = chart("https://ourworldindata.org/grapher/foo")
        const second = chart("https://ourworldindata.org/grapher/foo")
        const [section] = generateSidebarToc([heading(1, "A"), first, second])
        // Both blocks get unique anchors (HTML uniqueness) ...
        expect(first.anchorId).toBe("chart-foo")
        expect(second.anchorId).toBe("chart-foo-2")
        // ... but only the first becomes a bullet.
        expect(section.charts).toHaveLength(1)
    })

    it("keeps adjacent responsive chart variants as separate bullets", () => {
        const desktop = chart(
            "https://ourworldindata.org/grapher/population",
            "desktop"
        )
        const mobile = chart(
            "https://ourworldindata.org/grapher/population",
            "mobile"
        )
        const [section] = generateSidebarToc([heading(1, "A"), desktop, mobile])
        expect(desktop.anchorId).toBe("chart-population")
        expect(mobile.anchorId).toBe("chart-population-2")
        expect(section.charts).toEqual([
            {
                kind: "chart",
                url: "https://ourworldindata.org/grapher/population",
                anchorId: "chart-population",
                visibility: "desktop",
            },
            {
                kind: "chart",
                url: "https://ourworldindata.org/grapher/population",
                anchorId: "chart-population-2",
                visibility: "mobile",
            },
        ])
    })

    it("collapses a duplicate chart separated by non-heading content (only headings reset the run)", () => {
        const first = chart("https://ourworldindata.org/grapher/foo")
        const second = chart("https://ourworldindata.org/grapher/foo")
        const paragraph: OwidEnrichedGdocBlock = {
            type: "text",
            value: [span("A paragraph between the two charts")],
            parseErrors: [],
        }
        const [section] = generateSidebarToc([
            heading(1, "A"),
            first,
            paragraph,
            second,
        ])
        // Both still get unique anchors ...
        expect(first.anchorId).toBe("chart-foo")
        expect(second.anchorId).toBe("chart-foo-2")
        // ... but the paragraph doesn't reset the run, so it stays one bullet.
        expect(section.charts).toHaveLength(1)
    })

    it("keeps charts under their H1 across an intervening sub-heading", () => {
        const sections = generateSidebarToc([
            heading(1, "Section"),
            chart("https://ourworldindata.org/grapher/a"),
            heading(2, "Subsection"),
            chart("https://ourworldindata.org/grapher/b"),
        ])
        expect(sections).toHaveLength(1)
        expect(sections[0].charts.map((c) => c.anchorId)).toEqual([
            "chart-a",
            "chart-b",
        ])
    })

    it("re-emits an identical chart that recurs after a sub-heading", () => {
        // The sub-heading resets adjacent-dup tracking even though it isn't
        // surfaced, so the second occurrence is a distinct bullet.
        const first = chart("https://ourworldindata.org/grapher/a")
        const second = chart("https://ourworldindata.org/grapher/a")
        const [section] = generateSidebarToc([
            heading(1, "Section"),
            first,
            heading(2, "Subsection"),
            second,
        ])
        expect(first.anchorId).toBe("chart-a")
        expect(second.anchorId).toBe("chart-a-2")
        expect(section.charts.map((c) => c.anchorId)).toEqual([
            "chart-a",
            "chart-a-2",
        ])
    })

    it("namespaces chart anchors so they can't collide with heading slugs", () => {
        const fooChart = chart("https://ourworldindata.org/grapher/foo")
        const [section] = generateSidebarToc([heading(1, "Foo"), fooChart])
        expect(section.heading.slug).toBe("foo")
        expect(fooChart.anchorId).toBe("chart-foo")
        expect(section.charts[0].anchorId).toBe("chart-foo")
    })

    it("skips the all-charts block itself but not the content around it", () => {
        const sections = generateSidebarToc([
            heading(1, "Section"),
            {
                type: "all-charts",
                heading: "Interactive charts on X",
                top: [],
                parseErrors: [],
            },
            chart("https://ourworldindata.org/grapher/after"),
        ])
        expect(sections).toHaveLength(1)
        expect(sections[0].charts).toEqual([
            {
                kind: "chart",
                url: "https://ourworldindata.org/grapher/after",
                anchorId: "chart-after",
            },
        ])
    })

    it("opens synthetic H1 sections for featured-data-insights and explore-data-section, and excludes all-charts", () => {
        const sections = generateSidebarToc([
            {
                type: "all-charts",
                heading: "Interactive charts on X",
                top: [],
                parseErrors: [],
            },
            { type: "featured-data-insights", parseErrors: [] },
            {
                type: "explore-data-section",
                title: "Explore the data",
                align: "left",
                content: [],
                parseErrors: [],
            },
        ])
        expect(sections.map((s) => s.heading)).toEqual([
            {
                level: 1,
                text: "Data insights",
                slug: FEATURED_DATA_INSIGHTS_ID,
            },
            {
                level: 1,
                text: "Explore the data",
                slug: EXPLORE_DATA_SECTION_ID,
            },
        ])
    })

    it("skips featured-metrics entirely", () => {
        const sections = generateSidebarToc([
            heading(1, "Section"),
            { type: "featured-metrics", parseErrors: [] },
        ])
        expect(sections).toHaveLength(1)
        expect(sections[0].charts).toEqual([])
    })

    it("includes charts nested inside container blocks", () => {
        const nestedChart = chart("https://ourworldindata.org/grapher/nested")
        const keyInsightChart = chart(
            "https://ourworldindata.org/grapher/insight"
        )
        const stickyRight: OwidEnrichedGdocBlock = {
            type: "sticky-right",
            left: [nestedChart],
            right: [],
            parseErrors: [],
        }
        const keyInsights: OwidEnrichedGdocBlock = {
            type: "key-insights",
            heading: "Key insights",
            insights: [
                {
                    type: "key-insight-slide",
                    title: "Slide",
                    content: [keyInsightChart],
                },
            ],
            parseErrors: [],
        }
        const [section] = generateSidebarToc([
            heading(1, "Section"),
            stickyRight,
            keyInsights,
        ])
        expect(nestedChart.anchorId).toBe("chart-nested")
        expect(keyInsightChart.anchorId).toBe("chart-insight")
        expect(section.charts).toEqual([
            {
                kind: "chart",
                url: "https://ourworldindata.org/grapher/nested",
                anchorId: "chart-nested",
            },
            {
                kind: "chart",
                url: "https://ourworldindata.org/grapher/insight",
                anchorId: "chart-insight",
            },
        ])
    })

    it("includes narrative-chart bullets with a namespaced anchor", () => {
        const nc = narrativeChart("Population by age")
        const [section] = generateSidebarToc([heading(1, "Section"), nc])
        expect(nc.anchorId).toBe("chart-population-by-age")
        expect(section.charts[0]).toEqual({
            kind: "narrative-chart",
            name: "Population by age",
            anchorId: "chart-population-by-age",
        })
    })

    it("drops charts that precede the first H1 but still assigns their anchorId", () => {
        const orphan = chart("https://ourworldindata.org/grapher/orphan")
        const sections = generateSidebarToc([
            orphan,
            heading(1, "Section"),
            chart("https://ourworldindata.org/grapher/a"),
        ])
        // The orphan still gets an anchorId (for HTML uniqueness) ...
        expect(orphan.anchorId).toBe("chart-orphan")
        // ... but has no parent section, so it isn't a bullet.
        expect(sections).toHaveLength(1)
        expect(sections[0].charts.map((c) => c.anchorId)).toEqual(["chart-a"])
    })

    it("returns no sections when there are no H1s", () => {
        expect(
            generateSidebarToc([
                heading(2, "Just a subsection"),
                chart("https://ourworldindata.org/grapher/a"),
            ])
        ).toEqual([])
    })

    it("emits a bullet for an explorer URL, anchored by its slug", () => {
        // Explorers embed via the same chart block.
        const c = chart("https://ourworldindata.org/explorers/co2")
        const [section] = generateSidebarToc([heading(1, "Emissions"), c])
        expect(c.anchorId).toBe("chart-co2")
        expect(section.charts[0]).toEqual({
            kind: "chart",
            url: "https://ourworldindata.org/explorers/co2",
            anchorId: "chart-co2",
        })
    })

    it("treats a multi-dim /grapher URL like any chart (mdim-ness is resolved at render, invisible here)", () => {
        const c = chart("https://ourworldindata.org/grapher/education-spending")
        const [section] = generateSidebarToc([heading(1, "Education"), c])
        expect(c.anchorId).toBe("chart-education-spending")
        expect(section.charts[0].anchorId).toBe("chart-education-spending")
    })

    it("collapses adjacent same-slug charts even when query params differ (dedup is slug-only)", () => {
        const first = chart("https://ourworldindata.org/grapher/foo?tab=map")
        const second = chart("https://ourworldindata.org/grapher/foo?tab=table")
        const [section] = generateSidebarToc([heading(1, "A"), first, second])
        expect(first.anchorId).toBe("chart-foo")
        expect(second.anchorId).toBe("chart-foo-2")
        expect(section.charts).toHaveLength(1)
    })

    it("re-emits a same-slug chart with different query params when a different chart breaks the run (anchors stay query-blind)", () => {
        const first = chart(
            "https://ourworldindata.org/grapher/life-expectancy?tab=map"
        )
        const middle = chart("https://ourworldindata.org/grapher/gdp")
        const second = chart(
            "https://ourworldindata.org/grapher/life-expectancy?tab=table"
        )
        const [section] = generateSidebarToc([
            heading(1, "A"),
            first,
            middle,
            second,
        ])
        expect(first.anchorId).toBe("chart-life-expectancy")
        expect(second.anchorId).toBe("chart-life-expectancy-2")
        // Two life-expectancy bullets with identical labels at different anchors.
        expect(section.charts.map((c) => c.anchorId)).toEqual([
            "chart-life-expectancy",
            "chart-gdp",
            "chart-life-expectancy-2",
        ])
    })
})

describe(generateInlineToc, () => {
    it("lists only sub-H1 headings, in document order", () => {
        const headings = generateInlineToc([
            heading(1, "Top"),
            heading(2, "Two"),
            heading(3, "Three"),
            heading(2, "Two b"),
        ])
        expect(headings).toEqual([
            { level: 2, text: "Two", slug: "two" },
            { level: 3, text: "Three", slug: "three" },
            { level: 2, text: "Two b", slug: "two-b" },
        ])
    })

    it("preserves a heading's supertitle in the slug and entry", () => {
        const [entry] = generateInlineToc([heading(2, "Title", "Super")])
        expect(entry).toEqual({
            level: 2,
            text: "Title",
            slug: "super-title",
            supertitle: "Super",
        })
    })

    it("surfaces only H2 and H3 — H1 and H4+ are excluded", () => {
        const headings = generateInlineToc([
            heading(1, "One"),
            heading(2, "Two"),
            heading(3, "Three"),
            heading(4, "Four"),
            heading(5, "Five"),
        ])
        expect(headings.map((h) => h.text)).toEqual(["Two", "Three"])
    })

    it("ignores charts entirely — no entry and no anchorId mutation", () => {
        const c = chart("https://ourworldindata.org/grapher/foo")
        const nc = narrativeChart("Some chart")
        const headings = generateInlineToc([heading(2, "Section"), c, nc])
        expect(headings).toEqual([
            { level: 2, text: "Section", slug: "section" },
        ])
        expect(c.anchorId).toBeUndefined()
        expect(nc.anchorId).toBeUndefined()
    })

    it("ignores featured-data-insights and explore-data-section", () => {
        const headings = generateInlineToc([
            { type: "featured-data-insights", parseErrors: [] },
            {
                type: "explore-data-section",
                title: "Explore the data",
                align: "left",
                content: [],
                parseErrors: [],
            },
            heading(2, "Section"),
        ])
        expect(headings).toEqual([
            { level: 2, text: "Section", slug: "section" },
        ])
    })
})
