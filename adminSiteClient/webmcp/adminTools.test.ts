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
import { CHART_EDITOR_TOOL_SET, CHART_LIST_TOOL_SET } from "./toolSets.js"
import { registerToolSet, type WebMcpTool } from "./webmcpTypes.js"

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
    const getJSONInBackground = vi.fn(async (path: string, params?: any) => {
        if (path === "/api/charts.json") return { charts }
        if (path === "/api/variables.json") {
            // The dataset page lists a dataset's indicators through the search
            // endpoint; /api/datasets/:id.json carries every variable and runs
            // to megabytes, so nothing here may call it.
            if (String(params?.search).startsWith("path:"))
                return {
                    variables: [
                        { id: 91, name: "Total electricity consumption" },
                        { id: 92, name: "Projected total consumption" },
                    ],
                    numTotalRows: 2,
                }
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
        }
        if (path === "/api/datasets.json")
            return {
                datasets: [
                    {
                        id: 77,
                        name: "Energy and AI",
                        namespace: "energy",
                        shortName: "energy_ai",
                        version: "2026-06-30",
                    },
                ],
            }
        if (path === "/api/gdocs") return []
        throw new Error(`unexpected ${path}`)
    })
    const requestJSON = vi.fn(async (path: string) => {
        if (path === "/api/variables/5.json")
            return {
                variable: {
                    id: 5,
                    name: "Life expectancy at birth",
                    datasetName: "World Population Prospects",
                    catalogPath:
                        "grapher/un/2024-07-12/un_wpp/un_wpp#life_expectancy",
                },
            }
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

    let mounted: AbortController[] = []

    /**
     * Navigating in the real admin mounts the destination page, which
     * registers its tools; the navigation tools wait for exactly that, so the
     * fake history has to do it too.
     */
    const mountToolSetOnPush = (): ReturnType<typeof vi.fn> =>
        vi.fn((location: { pathname: string }) => {
            const set = location.pathname.startsWith("/charts/")
                ? CHART_EDITOR_TOOL_SET
                : location.pathname === "/charts"
                  ? CHART_LIST_TOOL_SET
                  : undefined
            if (!set) return
            const controller = new AbortController()
            mounted.push(controller)
            void registerToolSet(
                set,
                [
                    {
                        name: `${set}_probe`,
                        description: "x".repeat(50),
                        inputSchema: { type: "object", properties: {} },
                        execute: async () => "ok",
                    },
                ],
                controller.signal
            )
        })

    beforeEach(() => {
        invalidateChartCache()
        fake = makeAdmin()
        ;(document as any).modelContext = {
            registerTool: vi.fn().mockResolvedValue(undefined),
        }
        push = mountToolSetOnPush()
        setAdminHistory({ push, replace: vi.fn() } as unknown as History)
        tools = new Map(buildAdminTools(fake).map((t) => [t.name, t]))
    })

    afterEach(() => {
        setAdminHistory(undefined)
        mounted.forEach((c) => c.abort())
        mounted = []
    })

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

    it("get_indicator names the dataset the way find_indicators matches it", async () => {
        const text = await call("get_indicator", { variableId: 5 })
        expect(text).toContain(
            "Dataset: World Population Prospects (search it with dataset:un_wpp)"
        )
    })

    it("open_chart_editor navigates and returns once the editor's tools exist", async () => {
        const text = await call("open_chart_editor", { chartId: 12 })
        expect(push).toHaveBeenCalledWith({
            pathname: "/charts/12/edit",
            search: "",
        })
        expect(text).toContain("/admin/charts/12/edit")
        expect(text).toContain("tools are ready")
        expect(await call("open_chart_editor", { chartId: "x" })).toContain(
            "positive integer"
        )
    })

    it("open_charts_list waits for the list page's own tool", async () => {
        const text = await call("open_charts_list", { search: "co2" })
        expect(push).toHaveBeenCalledWith({
            pathname: "/charts",
            search: "?chartSearch=co2",
        })
        expect(text).toContain("search_chart_list")
    })

    describe("where_am_i", () => {
        const setPath = (path: string): void => {
            window.history.replaceState({}, "", path)
        }

        it("names the dataset and its indicator ids on a dataset page", async () => {
            setPath("/admin/datasets/77")
            const text = await call("where_am_i")
            expect(text).toContain(
                "dataset 77: Energy and AI (energy/2026-06-30/energy_ai)"
            )
            expect(text).toContain("91 | Total electricity consumption")
            expect(text).toContain("92 | Projected total consumption")

            // Never through /api/datasets/:id.json, which ships every variable.
            const paths = fake.getJSONInBackground.mock.calls.map((c) => c[0])
            expect(paths).toContain("/api/datasets.json")
            expect(
                paths.some((p: string) => /\/api\/datasets\/\d+\.json/.test(p))
            ).toBe(false)
        })

        it("names the indicator and its id on an indicator page", async () => {
            setPath("/admin/variables/5")
            const text = await call("where_am_i")
            expect(text).toContain("indicator 5: Life expectancy at birth")
            expect(text).toContain("dataset:un_wpp")
            expect(text).toContain("create_chart_from_indicator")
        })

        it("recognises the editor and the charts list", async () => {
            setPath("/admin/charts/9254/edit")
            expect(await call("where_am_i")).toContain("editing chart #9254")

            setPath("/admin/charts/create")
            expect(await call("where_am_i")).toContain("not been saved yet")

            setPath("/admin/charts")
            expect(await call("where_am_i")).toContain("The charts list.")
        })
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
