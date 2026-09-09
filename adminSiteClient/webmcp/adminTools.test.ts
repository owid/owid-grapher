/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { History } from "history"
import type { Admin } from "../Admin.js"
import type { ChartListItem } from "../ChartList.js"
import {
    buildAdminTools,
    clampLimit,
    filterGdocsBySearchString,
    invalidateChartCache,
    parseId,
} from "./adminTools.js"
import { buildChartEditorTools } from "./chartEditorTools.js"
import { buildChartListTools } from "./chartListTools.js"
import { setAdminHistory } from "./navigation.js"
import type { WebMcpTool } from "./webmcpTypes.js"

function chart(overrides: Partial<ChartListItem>): ChartListItem {
    return {
        id: 1,
        title: "",
        slug: "",
        internalNotes: "",
        variantName: "",
        isPublished: false,
        tab: undefined,
        hasMapTab: false,
        type: "LineChart",
        hasChartTab: true,
        lastEditedAt: "",
        lastEditedBy: "",
        publishedAt: "",
        publishedBy: "",
        tags: [],
        grapherViewsPerDay: 0,
        narrativeChartsCount: 0,
        referencesCount: 0,
        ...overrides,
    }
}

const charts = [
    chart({ id: 1, title: "CO2 emissions", slug: "co2", isPublished: true }),
    chart({
        id: 2,
        title: "Life expectancy",
        tags: [{ id: 9, name: "Health" }],
    }),
]

function makeAdmin() {
    const getJSONInBackground = vi.fn(async (path: string) => {
        if (path === "/api/charts.json") return { charts }
        if (path === "/api/variables.json")
            return {
                variables: [
                    {
                        id: 5,
                        name: "Life expectancy at birth",
                        dataset: "un_wpp",
                    },
                ],
                numTotalRows: 40,
            }
        if (path === "/api/gdocs") return []
        throw new Error(`unexpected ${path}`)
    })
    const requestJSON = vi.fn(async (path: string) => {
        if (path === "/api/variables/5.json")
            return { variable: { id: 5, name: "Life expectancy at birth" } }
        throw new Error("404")
    })
    return {
        admin: { getJSONInBackground, requestJSON } as unknown as Admin,
        getJSONInBackground,
        requestJSON,
    }
}

describe("helpers", () => {
    it("clampLimit falls back to the default and caps at the max", () => {
        expect(clampLimit(undefined)).toBe(20)
        expect(clampLimit(0)).toBe(20)
        expect(clampLimit(7.9)).toBe(7)
        expect(clampLimit(500)).toBe(50)
    })

    it("parseId accepts positive integers, as numbers or digit strings", () => {
        expect(parseId(12)).toBe(12)
        expect(parseId("12")).toBe(12)
        expect(parseId(0)).toBeUndefined()
        expect(parseId(-1)).toBeUndefined()
        expect(parseId(1.5)).toBeUndefined()
        expect(parseId("12abc")).toBeUndefined()
    })

    it("filterGdocsBySearchString searches title, slug, type, authors and tags", () => {
        const gdocs = [
            {
                id: "a",
                slug: "solar",
                title: "Solar power",
                type: "article",
                authors: ["Ada"],
                tags: [{ id: 1, name: "Energy" }],
                published: true,
            },
            {
                id: "b",
                slug: "health",
                title: "Health",
                type: "topic-page",
                authors: [],
                tags: [],
                published: false,
            },
        ] as any
        expect(
            filterGdocsBySearchString(gdocs, "energy").map((g: any) => g.id)
        ).toEqual(["a"])
        expect(
            filterGdocsBySearchString(gdocs, "ada").map((g: any) => g.id)
        ).toEqual(["a"])
        expect(
            filterGdocsBySearchString(gdocs, "topic-page").map((g: any) => g.id)
        ).toEqual(["b"])
    })
})

describe("admin-wide tools", () => {
    let tools: Map<string, WebMcpTool>
    let fake: ReturnType<typeof makeAdmin>
    let push: ReturnType<typeof vi.fn>

    const call = (name: string, input: any = {}): Promise<string> =>
        tools.get(name)!.execute(input)

    beforeEach(() => {
        invalidateChartCache()
        fake = makeAdmin()
        push = vi.fn()
        setAdminHistory({ push, replace: vi.fn() } as unknown as History)
        tools = new Map(buildAdminTools(fake).map((t) => [t.name, t]))
    })

    afterEach(() => setAdminHistory(undefined))

    it("find_charts filters the cached chart list and fetches it once", async () => {
        const text = await call("find_charts", { query: "health" })
        expect(text).toContain("1 matching charts")
        expect(text).toContain("#2 | Life expectancy")
        expect(text).toContain("/admin/charts/2/edit")

        await call("find_charts", { query: "co2" })
        expect(fake.getJSONInBackground).toHaveBeenCalledOnce()
    })

    it("find_indicators passes the query to the server and reports the total", async () => {
        const text = await call("find_indicators", { query: "life", limit: 5 })
        expect(fake.getJSONInBackground).toHaveBeenCalledWith(
            "/api/variables.json",
            { search: "life", limit: 5 }
        )
        expect(text).toContain("40 matching indicators")
        expect(text).toContain(
            "id: 5 | Life expectancy at birth | dataset: un_wpp"
        )
        expect(text).toContain("Showing 1 of 40")
    })

    it("get_indicator reports a missing indicator without throwing", async () => {
        expect(await call("get_indicator", { variableId: 999 })).toContain(
            "No indicator with id 999"
        )
        expect(await call("get_indicator", { variableId: 5 })).toContain(
            "Indicator 5: Life expectancy at birth"
        )
    })

    it("open_chart_editor navigates within the SPA", async () => {
        const text = await call("open_chart_editor", { chartId: 12 })
        expect(push).toHaveBeenCalledWith({
            pathname: "/charts/12/edit",
            search: "",
        })
        expect(text).toContain("/admin/charts/12/edit")
        expect(await call("open_chart_editor", { chartId: "x" })).toContain(
            "positive integer"
        )
    })

    it("create_chart_from_indicator opens the editor with the indicator on the y axis", async () => {
        const text = await call("create_chart_from_indicator", {
            variableId: 5,
        })
        expect(push).toHaveBeenCalledOnce()
        const { pathname, search } = push.mock.calls[0][0]
        expect(pathname).toBe("/charts/create")
        const config = JSON.parse(
            new URLSearchParams(search).get("config") ?? "{}"
        )
        expect(config.dimensions).toEqual([{ property: "y", variableId: 5 }])
        expect(config.hasMapTab).toBe(true)
        expect(text).toContain("as a world map")
    })

    it("create_chart_from_indicator refuses an unknown indicator", async () => {
        const text = await call("create_chart_from_indicator", {
            variableId: 999,
        })
        expect(text).toContain("No indicator with id 999")
        expect(text).toContain("Nothing was changed.")
        expect(push).not.toHaveBeenCalled()
    })
})

describe("tool contracts", () => {
    it("names are unique across all tool sets and every tool has a real description", () => {
        const all = [
            ...buildAdminTools(makeAdmin()),
            ...buildChartEditorTools({
                getEditor: () => undefined,
                getErrorMessages: () => ({}),
                getErrorMessagesForDimensions: () => ({
                    y: [],
                    x: [],
                    color: [],
                    size: [],
                    table: [],
                }),
            }),
            ...buildChartListTools({
                getCharts: () => [],
                getFilteredCharts: () => [],
                getSearchInput: () => "",
                setSearchInput: vi.fn(),
            }),
        ]
        const names = all.map((t) => t.name)
        expect(new Set(names).size).toBe(names.length)
        for (const tool of all) {
            expect(tool.name).toMatch(/^[a-z_]+$/)
            expect(tool.description.length).toBeGreaterThan(40)
            expect(tool.inputSchema.type).toBe("object")
        }
    })
})
