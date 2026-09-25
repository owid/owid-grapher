import { expect, it, describe, beforeEach } from "vitest"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import { GrapherState } from "../core/GrapherState.js"
import { buildGrapherTools } from "./grapherTools.js"
import { WebMcpTool } from "./webmcpTypes.js"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"

/**
 * Exercises the tools against a real GrapherState, the way an agent would.
 * This is the part worth testing: whether calling a tool actually moves the
 * chart, and whether a bad argument leaves it untouched rather than half-applied.
 */

const buildState = (): GrapherState => {
    const table = SynthesizeGDPTable(
        { entityCount: 5, timeRange: [1990, 2020] },
        1
    )
    return new GrapherState({
        table,
        ySlugs: "GDP",
        selectedEntityNames: [table.availableEntityNames[0]],
    })
}

describe("grapher WebMCP tools", () => {
    let grapherState: GrapherState
    let tools: Map<string, WebMcpTool>
    let entities: string[]

    const call = (name: string, input: any = {}): Promise<string> =>
        tools.get(name)!.execute(input)

    beforeEach(() => {
        grapherState = buildState()
        tools = new Map(buildGrapherTools(grapherState).map((t) => [t.name, t]))
        entities = grapherState.availableEntityNames
    })

    it("registers the expected tool set", () => {
        expect([...tools.keys()].sort()).toEqual([
            "add_entities",
            "download_chart_data",
            "get_chart_data",
            "get_chart_image_url",
            "get_chart_metadata",
            "get_chart_state",
            "list_chart_entities",
            "select_entities",
            "set_chart_view",
            "set_time_range",
        ])
    })

    it("every tool declares a description and an object schema", () => {
        for (const tool of tools.values()) {
            expect(tool.description.length).toBeGreaterThan(40)
            expect(tool.inputSchema.type).toBe("object")
        }
    })

    describe("get_chart_state", () => {
        it("reports the current selection so relative changes are possible", async () => {
            const result = await call("get_chart_state")
            const times = grapherState.times
            expect(result).toContain(entities[0])
            expect(result).toContain(String(times[0]))
            expect(result).toContain(String(times[times.length - 1]))
            expect(result).not.toContain("Infinity")
        })

        it("does not report 'undefined' years before the data has loaded", async () => {
            const empty = new GrapherState({})
            const tool = buildGrapherTools(empty).find(
                (t) => t.name === "get_chart_state"
            )!
            const result = await tool.execute({})
            expect(result).not.toContain("undefined")
            expect(result).toContain("not loaded yet")
        })
    })

    describe("select_entities", () => {
        it("replaces the selection", async () => {
            const result = await call("select_entities", {
                entities: [entities[1], entities[2]],
            })
            expect(grapherState.selection.selectedEntityNames).toEqual([
                entities[1],
                entities[2],
            ])
            expect(result).toContain(entities[1])
        })

        it("matches case-insensitively", async () => {
            await call("select_entities", {
                entities: [entities[1].toLowerCase()],
            })
            expect(grapherState.selection.selectedEntityNames).toEqual([
                entities[1],
            ])
        })

        it("changes nothing when any entity is unknown", async () => {
            const before = grapherState.selection.selectedEntityNames
            const result = await call("select_entities", {
                entities: [entities[1], "Wakanda"],
            })
            // Partial application would leave the chart in a state neither the
            // user nor the agent asked for.
            expect(grapherState.selection.selectedEntityNames).toEqual(before)
            expect(result).toContain("Wakanda")
            expect(result).toContain("Nothing was changed")
        })
    })

    describe("add_entities", () => {
        it("keeps what is already selected", async () => {
            // The case that motivates the whole prototype: "add X" requires
            // reading current state, which a URL cannot do.
            await call("select_entities", { entities: [entities[0]] })
            await call("add_entities", { entities: [entities[3]] })
            expect(grapherState.selection.selectedEntityNames).toEqual([
                entities[0],
                entities[3],
            ])
        })

        it("is idempotent", async () => {
            await call("select_entities", { entities: [entities[0]] })
            await call("add_entities", { entities: [entities[0]] })
            expect(grapherState.selection.selectedEntityNames).toEqual([
                entities[0],
            ])
        })
    })

    describe("list_chart_entities", () => {
        it("filters by substring", async () => {
            const target = entities[2]
            const result = await call("list_chart_entities", {
                query: target.slice(0, 3).toLowerCase(),
            })
            expect(result).toContain(target)
        })

        it("says so when nothing matches", async () => {
            const result = await call("list_chart_entities", {
                query: "zzzzz",
            })
            expect(result).toContain("No entities")
        })
    })

    describe("set_time_range", () => {
        it("sets both bounds", async () => {
            await call("set_time_range", { startYear: 2000, endYear: 2010 })
            expect(grapherState.timelineHandleTimeBounds).toEqual([2000, 2010])
        })

        it("leaves the other bound alone when only one is given", async () => {
            await call("set_time_range", { startYear: 2000, endYear: 2010 })
            await call("set_time_range", { startYear: 2005 })
            expect(grapherState.timelineHandleTimeBounds).toEqual([2005, 2010])
        })

        it("rejects an inverted range without changing anything", async () => {
            await call("set_time_range", { startYear: 2000, endYear: 2010 })
            const result = await call("set_time_range", {
                startYear: 2015,
                endYear: 1995,
            })
            expect(grapherState.timelineHandleTimeBounds).toEqual([2000, 2010])
            expect(result).toContain("Nothing was changed")
        })

        it("warns when the requested range exceeds the data", async () => {
            const result = await call("set_time_range", { startYear: 1800 })
            expect(result).toContain("1990")
        })

        it("requires at least one bound", async () => {
            const result = await call("set_time_range", {})
            expect(result).toContain("Nothing was changed")
        })
    })

    describe("get_chart_data", () => {
        it("returns real values as CSV, not a description of them", async () => {
            // The tool exists because without it an agent answers numeric
            // questions from memory; the trace showed exactly that.
            const result = await call("get_chart_data")
            expect(result).toContain("Entity")
            expect(result).toMatch(/\d/)
            expect(result.split("\n").length).toBeGreaterThan(1)
        })

        it("truncates rather than dumping an unbounded table", async () => {
            const result = await call("get_chart_data")
            const rows = result.split("\n").length
            expect(rows).toBeLessThan(500)
        })

        it("returns the selected entities, not every entity on the chart", async () => {
            // Found by driving the deployed preview: this read
            // `tableForDownload`, which is the whole chart. On
            // /grapher/electricity-mix with four countries selected it returned
            // 7,612 rows, and the 400-row cap sliced off everything after the
            // As — so none of the selected countries appeared at all, under a
            // description promising "the entities currently shown".
            const all = grapherState.availableEntityNames
            const [kept, dropped] = [all[0], all[all.length - 1]]
            expect(kept).not.toBe(dropped)
            await call("select_entities", { entities: [kept] })

            const result = await call("get_chart_data")
            expect(result).toContain(kept)
            expect(result).not.toContain(dropped)
        })
    })

    describe("get_chart_metadata", () => {
        it("reports the chart identity and its sources", async () => {
            const result = await call("get_chart_metadata")
            expect(result).toContain("Chart:")
            expect(result).toContain("Sources:")
        })
    })

    describe("get_chart_image_url", () => {
        it("declines when the chart has no public URL", async () => {
            // A synthetic chart is unpublished, so there is nothing to link.
            const result = await call("get_chart_image_url")
            expect(result).toContain("no public URL")
        })

        it("never navigates", async () => {
            const before = globalThis.location?.href
            await call("get_chart_image_url", { format: "svg" })
            expect(globalThis.location?.href).toBe(before)
        })
    })

    describe("set_chart_view", () => {
        it("refuses a view this chart does not have", async () => {
            const result = await call("set_chart_view", { view: "map" })
            expect(result).toContain("does not offer")
            expect(result).toContain("Nothing was changed")
        })

        it("switches to an available view", async () => {
            const target = grapherState.availableTabs[0]
            const result = await call("set_chart_view", { view: target })
            expect(grapherState.activeTab).toBe(target)
            expect(result).toContain(target)
        })

        it("accepts the name a user actually says", async () => {
            // Tabs are named "LineChart" internally; a model relays "line
            // chart". Before this, asking for a line chart was answered with
            // "this chart does not offer a line view".
            expect(grapherState.availableTabs).toContain(
                GRAPHER_TAB_NAMES.LineChart
            )
            for (const spoken of ["line", "Line Chart", "line-chart"]) {
                grapherState.setTab(GRAPHER_TAB_NAMES.Table)
                await call("set_chart_view", { view: spoken })
                expect(grapherState.activeTab).toBe(GRAPHER_TAB_NAMES.LineChart)
            }
        })
    })
})
