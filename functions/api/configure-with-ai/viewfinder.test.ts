import { describe, it, expect } from "vitest"
import {
    buildPrompt,
    ChartContext,
    requestSchema,
    MdimContext,
    parseJsonReply,
    sanitizeViews,
} from "./viewfinder.js"

const data = {
    entities: [
        {
            name: "Canada",
            code: "CAN",
            continent: "North America",
            type: "country" as const,
        },
        {
            name: "India",
            code: "IND",
            continent: "Asia",
            type: "country" as const,
        },
        { name: "World", code: "OWID_WRL", type: "region" as const },
    ],
    series: new Map<string, [number, number][]>([
        [
            "Canada",
            [
                [1990, 0.2],
                [2022, 0.3],
            ],
        ],
        [
            "India",
            [
                [1989, 50.123456],
                [2000, 40],
                [2010, 30],
                [2022, 12],
            ],
        ],
        [
            "World",
            [
                [1990, 38],
                [2022, 9],
            ],
        ],
    ]),
    minYear: 1989,
    maxYear: 2022,
}

const singleChart: ChartContext = {
    title: "Share of population living in extreme poverty",
    subtitle: "Living below the [poverty line](#dod:poverty-line).",
    indicatorName: "Share below $3 a day",
    unit: "%",
    seriesName: "Poverty rate",
    tolerance: 2,
    tabs: ["table", "map", "line", "discrete-bar"],
    currentTab: "line",
    selected: ["India"],
    data,
}

const mdim: MdimContext = {
    title: "Incomes across the distribution",
    dimensions: [
        {
            slug: "indicator",
            name: "Indicator",
            choices: [
                { slug: "mean", name: "Mean" },
                { slug: "thr", name: "Threshold" },
            ],
        },
        {
            slug: "decile",
            name: "Group",
            choices: [
                { slug: "_1", name: "Poorest" },
                { slug: "nan", name: "" },
            ],
        },
    ],
    views: [
        {
            dims: { indicator: "mean", decile: "nan" },
            title: "Mean income",
            seriesNames: ["Mean"],
            tabs: ["table", "map", "line"],
        },
        {
            dims: { indicator: "thr", decile: "_1" },
            title: "Poorest decile threshold",
            seriesNames: ["P10"],
            tabs: ["table", "line"],
        },
    ],
    current: { indicator: "mean", decile: "nan" },
}
const mdimChart: ChartContext = { ...singleChart, mdim }

describe("request validation", () => {
    it("fills in the defaults and caps the query at 100 characters", () => {
        expect(
            requestSchema.parse({
                slug: "life-expectancy",
                query: " add Canada ",
            })
        ).toEqual({
            slug: "life-expectancy",
            query: "add Canada",
            queryStr: "",
            model: "claude-haiku-5-5",
        })
        expect(
            requestSchema.safeParse({
                slug: "life-expectancy",
                query: "x".repeat(101),
            }).success
        ).toBe(false)
    })

    it("rejects models outside the allow-list and slugs that aren't slugs", () => {
        expect(
            requestSchema.safeParse({
                slug: "life-expectancy",
                query: "q",
                model: "claude-fable-5-1",
            }).success
        ).toBe(false)
        expect(
            requestSchema.safeParse({ slug: "../config", query: "q" }).success
        ).toBe(false)
    })
})

describe(sanitizeViews, () => {
    it("keeps valid fields, resolves entity codes and case, and reports what it dropped", () => {
        const result = sanitizeViews(
            {
                interpretation: "Poverty in India",
                views: [
                    {
                        label: "Table, sorted by fall",
                        note: "  Since 1990.  ",
                        tab: "table",
                        entities: ["IND", "canada", "Atlantis"],
                        time: "1990..2022",
                        mapRegion: "Mars",
                        tableSort: { column: "change", order: "asc" },
                        tableFilter: "selection",
                        closestMatch: true,
                    },
                    { label: "Scatter", tab: "scatter", entities: [] },
                ],
            },
            singleChart
        )
        expect(result.views).toEqual([
            {
                label: "Table, sorted by fall",
                note: "Since 1990.",
                tab: "table",
                entities: ["India", "Canada"],
                time: "1990..2022",
                mapRegion: null,
                tableSort: { column: "change", order: "asc" },
                tableFilter: "selection",
                closestMatch: true,
            },
        ])
        expect(result.dropped).toEqual(['entity "Atlantis"', 'tab "scatter"'])
    })

    it("rejects malformed time and table sort, and keeps at most four views", () => {
        const view = {
            tab: "line",
            time: "2000; drop table",
            tableSort: { column: "population" },
        }
        const result = sanitizeViews(
            { views: Array.from({ length: 6 }, () => view) },
            singleChart
        )
        expect(result.views).toHaveLength(4)
        expect(result.views[0]).toMatchObject({
            label: "Line chart",
            time: null,
            tableSort: null,
        })
    })

    it("survives a reply that isn't the expected shape", () => {
        expect(sanitizeViews("nonsense", singleChart)).toEqual({
            interpretation: "",
            views: [],
            dropped: [],
        })
    })

    it("on an MDim, requires a listed option combination and checks the tab against it", () => {
        const result = sanitizeViews(
            {
                views: [
                    {
                        options: { indicator: "thr", decile: "_1" },
                        tab: "line",
                    },
                    // "map" exists for the mean, but not for the threshold view
                    { options: { indicator: "thr", decile: "_1" }, tab: "map" },
                    { options: { indicator: "thr" }, tab: "line" },
                    { options: { indicator: "mean" }, tab: "map" },
                ],
            },
            mdimChart
        )
        expect(result.views.map((v) => [v.options, v.tab])).toEqual([
            [{ indicator: "thr", decile: "_1" }, "line"],
            [{ indicator: "mean", decile: "nan" }, "map"],
        ])
        expect(result.dropped).toEqual([
            'tab "map"',
            'options {"indicator":"thr"}',
        ])
    })
})

describe(buildPrompt, () => {
    it("keeps the per-request parts out of the cached prefix", () => {
        const a = buildPrompt(singleChart, "highest poverty")
        const b = buildPrompt(
            { ...singleChart, selected: ["Canada"], currentTab: "map" },
            "add <Canada>"
        )
        expect(a.cached).toBe(b.cached)
        expect(b.request).toContain('Tab: map, selected: ["Canada"]')
        expect(b.request).toContain("<request>add Canada</request>")
    })

    it("inlines the data as CSV with values near the decade marks", () => {
        const { cached } = buildPrompt(singleChart, "q")
        expect(cached).toContain(
            "entity,type,continent,v1990,v2000,v2010,latestYear,latestValue"
        )
        expect(cached).toContain("India,country,Asia,50.12,40,30,2022,12")
        expect(cached).toContain("Subtitle: Living below the poverty line.")
    })

    it("lists the MDim's combinations without dimensions that don't apply", () => {
        const { cached, request } = buildPrompt(mdimChart, "q")
        expect(cached).toContain(
            '- {"indicator":"mean"} → "Mean income" [1 series; tabs: table, map, line]'
        )
        expect(request).toContain('Options: {"indicator":"mean"}')
    })
})

describe(parseJsonReply, () => {
    it("tolerates a code fence around the JSON", () => {
        expect(parseJsonReply('```json\n{"views": []}\n```')).toEqual({
            views: [],
        })
        expect(() => parseJsonReply("Sorry, I can't.")).toThrow()
    })
})
