import { describe, expect, it } from "vitest"
import {
    ChartRecordType,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    buildCandidatePool,
    ChartHitWithoutId,
    PageHitWithoutId,
    parseAiSearchSettings,
    createComposerLineParser,
    parsePlannerAnswer,
} from "./aiSearch.js"

const chart = (
    slug: string,
    availableTabs: GrapherTabName[] = [GRAPHER_TAB_NAMES.LineChart]
): ChartHitWithoutId => ({
    type: ChartRecordType.Chart,
    title: slug,
    slug,
    availableTabs,
})

const page = (slug: string, type = OwidGdocType.Article): PageHitWithoutId => ({
    title: slug,
    slug,
    type,
})

describe(buildCandidatePool, () => {
    it("takes three hits per rank from the original search and one from each expansion", () => {
        const pool = buildCandidatePool(
            [
                {
                    charts: ["a1", "a2", "a3", "a4"].map((s) => chart(s)),
                    pages: [],
                },
                { charts: ["b1", "b2"].map((s) => chart(s)), pages: [] },
            ],
            { charts: 80, pages: 22 }
        )
        expect(pool.charts.map((c) => c.slug)).toEqual([
            "a1",
            "a2",
            "a3",
            "b1",
            "a4",
            "b2",
        ])
    })

    it("keeps a chart that several searches found once, at its first position", () => {
        const pool = buildCandidatePool(
            [
                { charts: [chart("shared"), chart("a2")], pages: [] },
                { charts: [chart("shared"), chart("b2")], pages: [] },
            ],
            { charts: 80, pages: 22 }
        )
        expect(pool.charts.map((c) => c.slug)).toEqual(["shared", "a2", "b2"])
    })

    it("caps charts at the pool size and articles in proportion to it", () => {
        const many = Array.from({ length: 200 }, (_, i) => `x${i}`)
        const pool = buildCandidatePool(
            [
                {
                    charts: many.map((s) => chart(s)),
                    pages: many.map((s) => page(s)),
                },
            ],
            { charts: 80, pages: 22 }
        )
        expect(pool.charts).toHaveLength(80)
        expect(pool.pages).toHaveLength(22)
        // ids are unique across charts and pages
        const ids = [...pool.charts, ...pool.pages].map((c) => c.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe(createComposerLineParser, () => {
    const pool = buildCandidatePool(
        [
            {
                charts: [
                    chart("with-map", [
                        GRAPHER_TAB_NAMES.LineChart,
                        GRAPHER_TAB_NAMES.WorldMap,
                    ]),
                    chart("line-only"),
                ],
                pages: [
                    page("an-article"),
                    page("an-insight", OwidGdocType.DataInsight),
                ],
            },
        ],
        { charts: 80, pages: 22 }
    )
    const id = (slug: string): number =>
        [...pool.charts, ...pool.pages].find((c) => c.slug === slug)!.id

    it("opens each chart on the view the model picked, if the chart has it", () => {
        const line = JSON.stringify({
            type: "group",
            angle: "today",
            title: "Around the world",
            blurb: "…",
            charts: [
                { id: id("with-map"), view: "map" },
                { id: id("line-only"), view: "map" },
            ],
        })
        const group = createComposerLineParser(pool)(line)
        expect(group).toMatchObject({
            type: "group",
            charts: [
                { id: id("with-map"), tab: GRAPHER_TAB_NAMES.WorldMap },
                { id: id("line-only") },
            ],
        })
    })

    it("drops ids that don't exist, were used by an earlier group, or have the wrong kind", () => {
        const parseLine = createComposerLineParser(pool)
        parseLine(
            JSON.stringify({ type: "group", charts: [{ id: id("with-map") }] })
        )
        const group = parseLine(
            JSON.stringify({
                type: "group",
                angle: "made-up",
                charts: [
                    { id: id("with-map") },
                    { id: 999 },
                    { id: id("line-only") },
                ],
                // an insight among articles, an article among insights
                articles: [id("an-insight"), id("an-article")],
                insights: [id("an-article")],
            })
        )
        expect(group).toMatchObject({
            angle: "other",
            charts: [{ id: id("line-only") }],
            articles: [id("an-article")],
            insights: [],
        })
    })

    it("ignores lines that aren't a usable group", () => {
        const parseLine = createComposerLineParser(pool)
        expect(parseLine("Here are the groups:")).toBeNull()
        expect(parseLine("{not json")).toBeNull()
        expect(parseLine('{"type":"group","charts":[{"id":999}]}')).toBeNull()
    })

    it("reads a group wrapped in a code fence", () => {
        const line =
            '```json{"type":"group","charts":[{"id":' +
            id("line-only") +
            "}]}```"
        expect(createComposerLineParser(pool)(line)?.type).toBe("group")
    })
})

describe(parsePlannerAnswer, () => {
    it("drops the original query, duplicates and non-strings", () => {
        expect(
            parsePlannerAnswer(
                JSON.stringify({
                    queries: [
                        "Life expectancy",
                        "child mortality",
                        "child mortality",
                        3,
                    ],
                }),
                "life expectancy"
            )
        ).toEqual(["child mortality"])
        expect(parsePlannerAnswer("not json", "x")).toEqual([])
    })
})

describe(parseAiSearchSettings, () => {
    it("falls back to the defaults for unknown values", () => {
        expect(
            parseAiSearchSettings(
                new URLSearchParams("model=gpt&pool=99&expand=0&debug=1")
            )
        ).toEqual({
            model: "claude-sonnet-5-5",
            effort: "low",
            expand: false,
            pool: 140,
            debug: true,
        })
    })
})
