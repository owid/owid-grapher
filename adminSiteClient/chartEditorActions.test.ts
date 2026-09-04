import { describe, expect, it, vi } from "vitest"
import {
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    OwidChartDimensionInterface,
    ScaleType,
    StackMode,
} from "@ourworldindata/types"
import { CONTINENTS_INDICATOR_ID, GrapherState } from "@ourworldindata/grapher"
import type { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    addChartType,
    removeChartType,
    removeVariableFromSlot,
    setSlotVariables,
} from "./chartEditorActions.js"
import {
    GDP_PER_CAPITA_CATALOG_PATH,
    POPULATION_CATALOG_PATH,
} from "./constants.js"

/**
 * A stand-in for the editor: a real GrapherState, with the data reload
 * (which hits the Data API) replaced by just committing the dimensions.
 */
function makeEditor(
    config: ConstructorParameters<typeof GrapherState>[0] = {}
): AbstractChartEditor & { grapherState: GrapherState } {
    const grapherState = new GrapherState({
        chartTypes: [GRAPHER_CHART_TYPES.LineChart],
        ...config,
    })
    return {
        grapherState,
        variableIdsByCatalogPath: {
            [GDP_PER_CAPITA_CATALOG_PATH]: 1001,
            [POPULATION_CATALOG_PATH]: 1002,
        },
        commitDimensionsAndReloadData: vi.fn(
            async (dims?: OwidChartDimensionInterface[]) => {
                if (dims) grapherState.setDimensionsFromConfigs(dims)
            }
        ),
    } as unknown as AbstractChartEditor & { grapherState: GrapherState }
}

const dimensionIds = (editor: AbstractChartEditor): [string, number][] =>
    editor.grapherState.dimensions.map((d) => [d.property, d.variableId])

describe(setSlotVariables, () => {
    it("sets the slot's indicators and keeps settings of ones already there", async () => {
        const editor = makeEditor({
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: 1,
                    display: { name: "Custom" },
                },
            ],
        })
        await setSlotVariables(editor, DimensionProperty.y, [1, 2])
        expect(dimensionIds(editor)).toEqual([
            ["y", 1],
            ["y", 2],
        ])
        expect(editor.grapherState.dimensions[0].display.name).toBe("Custom")
        expect(editor.commitDimensionsAndReloadData).toHaveBeenCalled()
    })

    it("refuses a slot the chart type does not have", async () => {
        const editor = makeEditor()
        await expect(
            setSlotVariables(editor, DimensionProperty.size, [1])
        ).rejects.toThrow('no "size" dimension slot')
        expect(dimensionIds(editor)).toEqual([])
    })
})

describe(removeVariableFromSlot, () => {
    it("removes only the named indicator", async () => {
        const editor = makeEditor({
            dimensions: [
                { property: DimensionProperty.y, variableId: 1 },
                { property: DimensionProperty.y, variableId: 2 },
            ],
        })
        await removeVariableFromSlot(editor, DimensionProperty.y, 1)
        expect(dimensionIds(editor)).toEqual([["y", 2]])
    })
})

describe("addChartType / removeChartType", () => {
    it("appends a compatible type and replaces with an incompatible one", async () => {
        const editor = makeEditor()
        await addChartType(editor, GRAPHER_CHART_TYPES.SlopeChart)
        expect(editor.grapherState.chartTypes).toEqual([
            GRAPHER_CHART_TYPES.LineChart,
            GRAPHER_CHART_TYPES.SlopeChart,
        ])

        await addChartType(editor, GRAPHER_CHART_TYPES.StackedArea)
        expect(editor.grapherState.chartTypes).toEqual([
            GRAPHER_CHART_TYPES.StackedArea,
        ])
    })

    it("applies the Marimekko defaults when it becomes the primary type", async () => {
        // Marimekko is incompatible with the stacked group, so it replaces it
        // and becomes the primary chart type.
        const editor = makeEditor({
            chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
            hideRelativeToggle: true,
        })
        await addChartType(editor, GRAPHER_CHART_TYPES.Marimekko)
        expect(editor.grapherState.chartTypes).toEqual([
            GRAPHER_CHART_TYPES.Marimekko,
        ])
        expect(editor.grapherState.stackMode).toBe(StackMode.relative)
        expect(editor.grapherState.hideRelativeToggle).toBe(false)
    })

    it("adds the default x, color and size indicators for a scatter plot", async () => {
        const editor = makeEditor({
            dimensions: [{ property: DimensionProperty.y, variableId: 1 }],
        })
        await addChartType(editor, GRAPHER_CHART_TYPES.ScatterPlot)
        expect(dimensionIds(editor)).toEqual([
            ["y", 1],
            ["x", 1001],
            ["color", CONTINENTS_INDICATOR_ID],
            ["size", 1002],
        ])
        expect(editor.grapherState.xAxis.scaleType).toBe(ScaleType.log)
        expect(editor.grapherState.xAxis.canChangeScaleType).toBe(true)
    })

    it("does nothing when the type is already enabled, and removes types", async () => {
        const editor = makeEditor()
        await addChartType(editor, GRAPHER_CHART_TYPES.LineChart)
        expect(editor.grapherState.chartTypes).toEqual([
            GRAPHER_CHART_TYPES.LineChart,
        ])
        await removeChartType(editor, GRAPHER_CHART_TYPES.LineChart)
        expect(editor.grapherState.chartTypes).toEqual([])
    })
})
