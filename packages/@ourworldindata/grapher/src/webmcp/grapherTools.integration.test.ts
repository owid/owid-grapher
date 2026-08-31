import { expect, it, describe, beforeEach } from "vitest"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import { GrapherState } from "../core/GrapherState.js"
import { buildGrapherTools } from "./grapherTools.js"
import { WebMcpTool } from "./webmcpTypes.js"

/**
 * Exercises the tools against a real GrapherState, the way an agent would.
 * This is the part worth testing: whether calling a tool actually moves the
 * chart, and whether a bad argument leaves it untouched rather than half-applied.
 */

const buildState = (): GrapherState => {
    const table = SynthesizeGDPTable({ entityCount: 5, timeRange: [1990, 2020] }, 1)
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
    })
})
