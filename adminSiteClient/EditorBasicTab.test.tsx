import { describe, expect, it } from "vitest"
import { GRAPHER_CHART_TYPES } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { DimensionSlotView } from "./EditorBasicTab.js"

describe("DimensionSlotView#updateDefaultSelection", () => {
    it("keeps an existing entity selection when switching to Marimekko", async () => {
        const grapherState = new GrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            selectedEntityNames: ["France", "Germany"],
        })

        const view = new DimensionSlotView({
            slot: {} as any,
            editor: { grapherState } as any,
            database: {} as any,
            errorMessagesForDimensions: {} as any,
        })

        // Mirrors checking the "Marimekko" chart type checkbox in the
        // admin, which replaces the chart's chartTypes list.
        grapherState.chartTypes = [GRAPHER_CHART_TYPES.Marimekko]

        await (view as any).updateDefaultSelection()

        expect(grapherState.selection.selectedEntityNames).toEqual([
            "France",
            "Germany",
        ])
    })
})
