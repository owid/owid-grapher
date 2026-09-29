/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import {
    DimensionProperty,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { ChartEditor, ChartEditorManager } from "./ChartEditor.js"

function makeEditor(dimensions: OwidChartDimensionInterface[]): ChartEditor {
    const editor = new ChartEditor({
        manager: {
            admin: {},
            patchConfig: {},
            isInheritanceEnabled: false,
            logs: [],
            references: undefined,
            redirects: [],
        } as unknown as ChartEditorManager,
    })
    editor.grapherState.setDimensionsFromConfigs(dimensions)
    return editor
}

describe("ChartEditor.reloadGrapherData", () => {
    it("passes dimension configs, not ChartDimension instances", async () => {
        const editor = makeEditor([
            {
                property: DimensionProperty.x,
                variableId: 123,
                targetYear: 2000,
            },
        ])
        const loader = vi.fn().mockResolvedValue(undefined)
        editor.cachingGrapherDataLoader = loader

        await editor.reloadGrapherData()

        expect(loader.mock.calls[0][0]).toEqual([
            {
                property: DimensionProperty.x,
                variableId: 123,
                targetYear: 2000,
            },
        ])
    })
})
