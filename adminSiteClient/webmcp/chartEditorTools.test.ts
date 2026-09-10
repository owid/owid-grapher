import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import { GRAPHER_CHART_TYPES, GrapherInterface } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import type { ChartEditor } from "../ChartEditor.js"
import type { ErrorMessages } from "../ChartEditorTypes.js"
import { buildChartEditorTools, editingErrors } from "./chartEditorTools.js"
import { CHART_EDITOR_TOOL_SET } from "./toolSets.js"
import { registerToolSet, type WebMcpTool } from "./webmcpTypes.js"

let mountedEditors: AbortController[] = []

/** Stand in for the editor page mounting and registering its tools. */
function remountEditorToolSet(): void {
    mountedEditors.forEach((c) => c.abort())
    const controller = new AbortController()
    mountedEditors.push(controller)
    void registerToolSet(
        CHART_EDITOR_TOOL_SET,
        [
            {
                name: "editor_probe",
                description: "x".repeat(50),
                inputSchema: { type: "object", properties: {} },
                execute: async () => "ok",
            },
        ],
        controller.signal
    )
}

/**
 * Drives the editor tools against a real GrapherState the way an agent would,
 * checking both the returned text and whether the chart actually moved (or,
 * for refused input, stayed put).
 */

interface FakeEditor {
    editor: ChartEditor
    grapherState: GrapherState
    requestJSON: ReturnType<typeof vi.fn>
    saveGrapher: ReturnType<typeof vi.fn>
}

const KNOWN_INDICATORS: Record<number, { id: number; name: string }> = {
    5: { id: 5, name: "Life expectancy" },
    6: { id: 6, name: "Population" },
}

function makeEditor(overrides: Partial<GrapherInterface> = {}): FakeEditor {
    const table = SynthesizeGDPTable(
        { entityCount: 5, timeRange: [1990, 2020] },
        1
    )
    const grapherState = new GrapherState({
        table,
        ySlugs: "GDP",
        chartTypes: [GRAPHER_CHART_TYPES.LineChart],
        selectedEntityNames: [table.availableEntityNames[0]],
        ...overrides,
    })
    const requestJSON = vi.fn(async (path: string) => {
        const match = path.match(/\/api\/variables\/(\d+)\.json/)
        if (match) {
            const variable = KNOWN_INDICATORS[Number(match[1])]
            if (!variable) throw new Error("404")
            return { variable }
        }
        return { success: true }
    })
    // A first save redirects to /charts/:id/edit, remounting the editor and
    // re-registering its tools; save_chart waits for that, so the fake has to
    // do it too.
    const saveGrapher = vi.fn(async () => {
        fake.isNewGrapher = false
        grapherState.id = 77
        grapherState.version = 1
        remountEditorToolSet()
    })
    // What the editor was initialised with, which is what a discard reverts
    // to; the real one derives it from the manager's patch and parent config.
    const originalGrapherConfig = grapherState.object

    const fake = {
        grapherState,
        originalGrapherConfig,
        reloadGrapherData: vi.fn().mockResolvedValue(undefined),
        tab: "basic",
        showStaticPreview: false,
        availableTabs: ["basic", "data", "text", "export"],
        isNewGrapher: true,
        isModified: true,
        newChartId: undefined,
        availableTags: [
            { id: 1, name: "Health" },
            { id: 2, name: "Energy" },
        ],
        manager: { admin: { requestJSON }, tags: [] },
        get tags() {
            return this.manager.tags
        },
        get liveConfig() {
            return grapherState.object
        },
        /** Mirrors AbstractChartEditor's computed of the same name. */
        get invalidSelectedEntityNames(): string[] {
            const available = new Set(grapherState.availableEntityNames)
            return grapherState.selection.selectedEntityNames.filter(
                (name) => !available.has(name)
            )
        },
        updateLiveGrapher(config: GrapherInterface) {
            grapherState.reset()
            grapherState.updateFromObject(config)
            grapherState.updateAuthoredVersion(config)
        },
        commitDimensionsAndReloadData: vi.fn().mockResolvedValue(undefined),
        saveGrapher,
    }
    return {
        editor: fake as unknown as ChartEditor,
        grapherState,
        requestJSON,
        saveGrapher,
    }
}

describe("chart editor WebMCP tools", () => {
    let fake: FakeEditor
    let tools: Map<string, WebMcpTool>
    let errors: ErrorMessages
    let entities: string[]

    const call = (name: string, input: any = {}): Promise<string> =>
        tools.get(name)!.execute(input)

    beforeEach(() => {
        ;(globalThis as any).document = {
            modelContext: {
                registerTool: vi.fn().mockResolvedValue(undefined),
            },
        }
        fake = makeEditor()
        errors = {}
        tools = new Map(
            buildChartEditorTools({
                getEditor: () => fake.editor,
                getErrorMessages: () => errors,
                getErrorMessagesForDimensions: () => ({
                    y: [],
                    x: [],
                    color: [],
                    size: [],
                    table: [],
                }),
            }).map((t) => [t.name, t])
        )
        entities = fake.grapherState.availableEntityNames
    })

    afterEach(() => {
        mountedEditors.forEach((c) => c.abort())
        mountedEditors = []
    })

    it("describes the editor state", async () => {
        const text = await call("get_chart_editor_state")
        expect(text).toContain("Chart: new, not saved yet")
        expect(text).toContain("Chart types: LineChart")
        expect(text).toContain(`Selected entities (1): ${entities[0]}`)
        expect(text).toContain("Editing errors: none")
        expect(text).not.toContain("undefined")
    })

    it("reports loading until the editor exists", async () => {
        const loading = buildChartEditorTools({
            getEditor: () => undefined,
            getErrorMessages: () => ({}),
            getErrorMessagesForDimensions: () => ({
                y: [],
                x: [],
                color: [],
                size: [],
                table: [],
            }),
        })
        expect(await loading[0].execute({})).toContain("still loading")
    })

    describe("state a reader of the chart would notice", () => {
        it("flags selected entities that are not in the data", async () => {
            fake.grapherState.selection.setSelectedEntities([
                entities[0],
                "Japan",
            ])
            const text = await call("get_chart_editor_state")
            expect(text).toContain("Not in this chart's data")
            expect(text).toContain("Japan")
            expect(text).toContain("select_entities")
        })

        it("says nothing about invalid entities when there are none", async () => {
            expect(await call("get_chart_editor_state")).not.toContain(
                "Not in this chart's data"
            )
        })

        it("reports axis and time settings that outlive an edit", async () => {
            await call("update_chart_config", {
                patch: { yAxis: { min: 70 }, minTime: 1990 },
            })
            const text = await call("get_chart_editor_state")
            expect(text).toContain("y axis min 70")
            expect(text).toContain("min time 1990")
        })

        it("omits the settings line when nothing is set, sentinels included", async () => {
            // Unbounded time is stored as ±Infinity; reporting it would read
            // as a deliberate setting.
            const text = await call("get_chart_editor_state")
            expect(text).not.toContain("Other settings:")
            expect(text).not.toContain("Infinity")
        })

        it("does not present an indicator id as its name while data loads", async () => {
            fake.grapherState.setDimensionsFromConfigs([
                { property: "y" as any, variableId: 1295512 },
            ])
            const text = await call("get_chart_editor_state")
            expect(text).toContain("1295512 (name still loading)")
            expect(text).not.toContain('1295512 "1295512"')
        })
    })

    describe("get_chart_data", () => {
        it("returns the drawn data as CSV so the agent can judge the chart", async () => {
            const csv = await call("get_chart_data")
            const [header, ...rows] = csv.split("\n")
            expect(header).toContain("Entity")
            expect(rows.length).toBeGreaterThan(0)
            // Only the selected entity is drawn, so only it should appear.
            expect(csv).toContain(entities[0])
            expect(csv).not.toContain(entities[3])
        })

        it("reports honestly when the data is not loaded", async () => {
            const notReady = buildChartEditorTools({
                getEditor: () =>
                    ({
                        grapherState: { isReady: false },
                    }) as unknown as ChartEditor,
                getErrorMessages: () => ({}),
                getErrorMessagesForDimensions: () => ({
                    y: [],
                    x: [],
                    color: [],
                    size: [],
                    table: [],
                }),
            })
            const tool = notReady.find((t) => t.name === "get_chart_data")!
            expect(await tool.execute({})).toContain("not loaded yet")
        })
    })

    describe("entities", () => {
        it("replaces the selection, resolving case-insensitively", async () => {
            const text = await call("select_entities", {
                entities: [entities[1].toUpperCase(), entities[2]],
            })
            expect(fake.grapherState.selection.selectedEntityNames).toEqual([
                entities[1],
                entities[2],
            ])
            expect(text).toContain("Selected entities (2)")
        })

        it("refuses an unknown entity and changes nothing", async () => {
            const before = [...fake.grapherState.selection.selectedEntityNames]
            const text = await call("select_entities", {
                entities: [entities[1], "Atlantis"],
            })
            expect(text).toContain('"Atlantis" is not an entity')
            expect(text).toContain("Nothing was changed.")
            expect(fake.grapherState.selection.selectedEntityNames).toEqual(
                before
            )
        })

        it("adds without removing", async () => {
            await call("add_entities", { entities: [entities[3]] })
            expect(fake.grapherState.selection.selectedEntityNames).toEqual([
                entities[0],
                entities[3],
            ])
        })
    })

    describe("chart types", () => {
        it("accepts loose spellings and shows the Basic tab", async () => {
            ;(fake.editor as any).tab = "text"
            const text = await call("add_chart_type", {
                chartType: "marimekko",
            })
            // Marimekko can be combined with a line chart, so it is appended
            expect(fake.grapherState.chartTypes).toEqual([
                GRAPHER_CHART_TYPES.LineChart,
                GRAPHER_CHART_TYPES.Marimekko,
            ])
            expect(fake.editor.tab).toBe("basic")
            expect(text).toContain("Chart types are now: LineChart, Marimekko")
        })

        it("refuses unknown types with the valid list", async () => {
            const text = await call("add_chart_type", { chartType: "pie" })
            expect(text).toContain('"pie" is not a chart type')
            expect(text).toContain("LineChart, ScatterPlot")
            expect(text).toContain("Nothing was changed.")
            expect(fake.grapherState.chartTypes).toEqual([
                GRAPHER_CHART_TYPES.LineChart,
            ])
        })

        it("says so when the type is already enabled", async () => {
            expect(
                await call("add_chart_type", { chartType: "line chart" })
            ).toContain("already enabled")
        })

        it("removes a type", async () => {
            await call("remove_chart_type", { chartType: "LineChart" })
            expect(fake.grapherState.chartTypes).toEqual([])
        })
    })

    describe("indicators", () => {
        it("adds indicators that exist and keeps the ones already there", async () => {
            fake.grapherState.setDimensionsFromConfigs([
                { property: "y" as any, variableId: 5 },
            ])
            const text = await call("add_indicators", { variableIds: [6] })
            expect(
                fake.grapherState.dimensions.map((d) => d.variableId)
            ).toEqual([5, 6])
            expect(text).toContain('Added 6 "Population" to the y slot')
        })

        it("refuses when any indicator does not exist and changes nothing", async () => {
            const text = await call("add_indicators", { variableIds: [5, 999] })
            expect(text).toContain("No indicator exists with id 999")
            expect(text).toContain("Nothing was changed.")
            expect(fake.grapherState.dimensions).toEqual([])
        })

        it("refuses a slot the chart type does not have", async () => {
            const text = await call("add_indicators", {
                variableIds: [5],
                slot: "size",
            })
            expect(text).toContain('"size" is not a dimension slot')
            expect(text).toContain("Nothing was changed.")
        })

        it("refuses to remove an indicator that is not on the chart", async () => {
            const text = await call("remove_indicator", { variableId: 5 })
            expect(text).toContain("Indicator 5 is not on this chart")
            expect(text).toContain("Nothing was changed.")
        })
    })

    describe("update_chart_config", () => {
        it("applies a valid patch while keeping the chart's identity", async () => {
            fake.grapherState.id = 12
            const text = await call("update_chart_config", {
                patch: { title: "New title", yAxis: { min: 0 } },
            })
            expect(fake.grapherState.title).toBe("New title")
            expect(fake.grapherState.yAxis.min).toBe(0)
            expect(fake.grapherState.id).toBe(12)
            expect(text).toContain("Updated title, yAxis.")
            expect(text).toContain("Title: New title")
        })

        it("refuses denied and unknown fields without touching the chart", async () => {
            const denied = await call("update_chart_config", {
                patch: { title: "x", isPublished: true },
            })
            expect(denied).toContain('"isPublished" cannot be set')
            expect(denied).toContain("Nothing was changed.")

            const unknown = await call("update_chart_config", {
                patch: { titel: "x" },
            })
            expect(unknown).toContain('"titel"')
            expect(fake.grapherState.title).toBeUndefined()
        })
    })

    describe("tags", () => {
        it("refuses on an unsaved chart", async () => {
            const text = await call("set_chart_tags", { tagNames: ["Health"] })
            expect(text).toContain("call save_chart first")
            expect(fake.requestJSON).not.toHaveBeenCalled()
        })

        it("never guesses a tag name", async () => {
            ;(fake.editor as any).isNewGrapher = false
            fake.grapherState.id = 12
            const text = await call("set_chart_tags", { tagNames: ["Heal"] })
            expect(text).toContain("Did you mean: Health?")
            expect(fake.requestJSON).not.toHaveBeenCalled()
        })

        it("saves resolved tags immediately", async () => {
            ;(fake.editor as any).isNewGrapher = false
            fake.grapherState.id = 12
            const text = await call("set_chart_tags", {
                tagNames: ["health", "Energy"],
            })
            expect(fake.requestJSON).toHaveBeenCalledWith(
                "/api/charts/12/setTags",
                {
                    tags: [
                        { id: 1, name: "Health" },
                        { id: 2, name: "Energy" },
                    ],
                },
                "POST"
            )
            expect(fake.editor.manager.tags).toEqual([
                { id: 1, name: "Health" },
                { id: 2, name: "Energy" },
            ])
            expect(text).toContain("Tags are now: Health, Energy.")
        })
    })

    describe("switch_editor_tab", () => {
        it("switches to an available tab and refuses others", async () => {
            expect(await call("switch_editor_tab", { tab: "Text" })).toContain(
                "Showing the text tab"
            )
            expect(fake.editor.tab).toBe("text")
            const refused = await call("switch_editor_tab", { tab: "colors" })
            expect(refused).toContain("Available: basic, data, text, export")
            expect(fake.editor.tab).toBe("text")
        })
    })

    describe("save_chart", () => {
        it("creates a draft and tells the agent the editor reloads", async () => {
            const text = await call("save_chart")
            expect(fake.saveGrapher).toHaveBeenCalled()
            expect(text).toContain("Created draft chart #77")
            expect(text).toContain("/admin/charts/77/edit")
        })

        it("refuses on a published chart", async () => {
            fake.grapherState.isPublished = true
            fake.grapherState.id = 12
            const text = await call("save_chart")
            expect(text).toContain("is published")
            expect(text).toContain("Nothing was changed.")
            expect(fake.saveGrapher).not.toHaveBeenCalled()
        })

        it("refuses while there are editing errors", async () => {
            errors = { originUrl: "Invalid origin URL" }
            const text = await call("save_chart")
            expect(text).toContain("Invalid origin URL")
            expect(fake.saveGrapher).not.toHaveBeenCalled()
        })

        it("points at discarding when the chart is published", async () => {
            fake.grapherState.isPublished = true
            expect(await call("save_chart")).toContain("discard_chart_changes")
        })
    })

    describe("discard_chart_changes", () => {
        const editor = (): any => fake.editor as any

        it("puts the chart back to its saved state and reloads the data", async () => {
            const original = fake.grapherState.title
            await call("update_chart_config", {
                patch: { title: "Something else", subtitle: "Added" },
            })
            expect(fake.grapherState.title).toBe("Something else")

            editor().isNewGrapher = false
            fake.grapherState.id = 7283
            const text = await call("discard_chart_changes")

            expect(fake.grapherState.title).toBe(original)
            expect(fake.grapherState.subtitle).toBeFalsy()
            expect(editor().reloadGrapherData).toHaveBeenCalled()
            expect(text).toContain("Discarded the unsaved changes")
            expect(text).toContain("#7283")
            expect(text).not.toContain("undefined")
        })

        it("is the way out of a published chart that cannot be saved", async () => {
            fake.grapherState.isPublished = true
            editor().isNewGrapher = false
            await call("update_chart_config", { patch: { title: "Edited" } })
            expect(await call("save_chart")).toContain("Nothing was changed.")

            await call("discard_chart_changes")
            expect(fake.grapherState.title).not.toBe("Edited")
        })

        it("says so when there is nothing to discard", async () => {
            editor().isModified = false
            const text = await call("discard_chart_changes")
            expect(text).toContain("no unsaved changes")
            expect(editor().reloadGrapherData).not.toHaveBeenCalled()
        })
    })
})

describe(editingErrors, () => {
    it("flattens field and dimension errors like the save button does", () => {
        expect(
            editingErrors({
                getEditor: () => undefined,
                getErrorMessages: () => ({ note: "bad DoD" }),
                getErrorMessagesForDimensions: () => ({
                    y: ["detail syntax"],
                    x: [],
                    color: [],
                    size: [],
                    table: [],
                }),
            })
        ).toEqual(["bad DoD", "detail syntax"])
    })
})
