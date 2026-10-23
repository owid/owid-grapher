import { describe, it, expect } from "vitest"
import {
    buildPrompt,
    coverageLine,
    ChartContext,
    requestSchema,
    MdimContext,
    parseJsonReply,
    rankEntities,
    sanitizeSuggestions,
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
    currentTime: null,
    mapTolerance: 5,
    columnTolerance: 0,
    canSelectEntities: true,
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
            model: "claude-sonnet-5-5",
            tableSort: null,
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
                facts: null,
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
            searchQuery: null,
            views: [],
            dropped: [],
        })
    })

    it("keeps a short search query for data this chart doesn't have", () => {
        expect(
            sanitizeViews(
                { views: [], searchQuery: "  cumulative CO2 emissions " },
                singleChart
            ).searchQuery
        ).toBe("cumulative CO2 emissions")
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
            {
                ...singleChart,
                selected: ["Canada"],
                currentTab: "table",
                currentTime: "2000..2022",
                currentTableSort: { column: "change", order: "asc" },
            },
            "add <Canada>"
        )
        expect(a.cached).toBe(b.cached)
        expect(b.request).toContain(
            'Tab: table, selected: ["Canada"], time: 2000..2022, table sort: change asc'
        )
        expect(a.request).toContain(
            "time: the chart's default, table sort: none"
        )
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

    it("counts the countries with a value in the last years that have data", () => {
        // Sparse years (as in 5-yearly data) are listed by their own years
        expect(coverageLine(singleChart.data, 3)).toBe(
            "2000: 1, 2010: 1, 2022: 2"
        )
        expect(buildPrompt(singleChart, "q").cached).toContain(
            "Countries with a value in each year: "
        )
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

describe(sanitizeSuggestions, () => {
    it("keeps up to three distinct suggestions that fit the input", () => {
        expect(
            sanitizeSuggestions({
                suggestions: [
                    " Compare Kenya and Uganda ",
                    "Compare Kenya and Uganda",
                    "",
                    42,
                    "x".repeat(101),
                    "Which countries are highest?",
                    "Since 1990",
                    "One too many",
                ],
            })
        ).toEqual([
            "Compare Kenya and Uganda",
            "Which countries are highest?",
            "Since 1990",
        ])
        expect(sanitizeSuggestions({ views: [] })).toEqual([])
    })
})

describe(rankEntities, () => {
    it("ranks countries by their value in the year, leaving out regions", () => {
        expect(
            rankEntities(
                data,
                {
                    order: "highest",
                    by: "value",
                    from: null,
                    n: 5,
                    year: 2022,
                    continent: null,
                },
                0
            )
        ).toEqual({
            entities: ["India", "Canada"],
            facts: "Highest 2 of the 2 countries with data for 2022",
        })
    })

    it("filters by continent and uses the closest year within the tolerance", () => {
        expect(
            rankEntities(
                data,
                {
                    order: "lowest",
                    by: "value",
                    from: null,
                    n: 1,
                    year: 1990,
                    continent: "Asia",
                },
                1
            )
        ).toEqual({
            entities: ["India"],
            facts: "Lowest 1 of the 1 countries in Asia with data for 1990 (or the closest year within 1)",
        })
    })
})

describe("ranked changes", () => {
    it("ranks by the change between two years and keeps only the direction asked for", () => {
        expect(
            rankEntities(
                data,
                {
                    order: "lowest",
                    by: "change",
                    from: 1990,
                    n: 10,
                    year: 2022,
                    continent: null,
                },
                1
            )
        ).toEqual({
            // Canada rose (0.2 to 0.3), so it isn't among the falls
            entities: ["India"],
            facts: "Largest 1 falls from 1990 to 2022, of the 2 countries with data for both years (or the closest year within 1)",
        })
    })

    it("sets a table to the range and sorts it by the change", () => {
        const { views } = sanitizeViews(
            {
                views: [
                    {
                        tab: "table",
                        entities: [],
                        rank: {
                            order: "lowest",
                            by: "change",
                            from: 1990,
                            n: 5,
                            year: 2022,
                            continent: null,
                        },
                    },
                ],
            },
            { ...singleChart, columnTolerance: 1 }
        )
        expect(views[0]).toMatchObject({
            entities: ["India"],
            time: "1990..2022",
            tableSort: { column: "change", order: "asc" },
        })
    })
})

describe("ranked views", () => {
    it("lets code pick the countries and set the table's year, filter and sort", () => {
        const { views } = sanitizeViews(
            {
                views: [
                    {
                        label: "Table, lowest first",
                        tab: "table",
                        entities: ["World"],
                        time: null,
                        rank: {
                            order: "lowest",
                            n: 10,
                            year: 2022,
                            continent: "Mars",
                        },
                    },
                ],
            },
            singleChart
        )
        expect(views[0]).toMatchObject({
            entities: ["Canada", "India"],
            time: "2022",
            tableFilter: "selection",
            tableSort: { column: "value", order: "asc" },
            facts: "Lowest 2 of the 2 countries with data for 2022",
        })
    })

    it("says how many countries shown lack data for a single year", () => {
        const { views } = sanitizeViews(
            {
                views: [
                    {
                        tab: "discrete-bar",
                        entities: ["Canada", "India"],
                        time: "2000",
                    },
                ],
            },
            singleChart
        )
        expect(views[0].facts).toBe("1 of 2 have data for 2000")
    })
})

describe("ranked views on another MDim combination", () => {
    it("sorts a table but drops a line chart that has no countries", () => {
        const rank = { order: "highest", n: 10, year: 2022, continent: null }
        const options = { indicator: "thr", decile: "_1" }
        const { views, dropped } = sanitizeViews(
            {
                views: [
                    { tab: "table", entities: [], options, rank },
                    { tab: "line", entities: [], options, rank },
                ],
            },
            mdimChart
        )
        expect(views).toHaveLength(1)
        expect(views[0]).toMatchObject({
            tab: "table",
            time: "2022",
            tableSort: { column: "value", order: "desc" },
        })
        expect(dropped).toEqual(["rank on another combination (line)"])
    })
})

describe("charts whose countries are fixed", () => {
    it("drops a view that selects countries the chart can't change", () => {
        const { views, dropped, interpretation } = sanitizeViews(
            {
                views: [
                    {
                        tab: "table",
                        entities: ["India"],
                        rank: {
                            order: "highest",
                            n: 5,
                            year: 2022,
                            continent: null,
                        },
                    },
                ],
            },
            { ...singleChart, canSelectEntities: false }
        )
        expect(views).toEqual([])
        expect(interpretation).toMatch(/always shows the same countries/)
        expect(dropped).toEqual([
            "view selecting countries on a fixed chart (table)",
        ])
    })
})
