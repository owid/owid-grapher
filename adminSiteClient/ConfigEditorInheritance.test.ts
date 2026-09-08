/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"
import { IndicatorStore } from "./indicatorStores.js"

// The chart's own ETL-authored layer sits between the indicator config and the
// admin patch, and is applied regardless of `isInheritanceEnabled`.
const parentConfig: GrapherInterface = {
    note: "Indicator note",
    subtitle: "Indicator subtitle",
}
const etlConfig: GrapherInterface = {
    title: "ETL title",
    hasMapTab: true,
}
const patchConfig: GrapherInterface = { title: "Admin title" }

function makeEditor(store?: IndicatorStore): ConfigEditor {
    const manager: ConfigEditorManager = {
        patchConfig,
        parentConfig,
        parentVariableId: 1,
        etlConfig,
        isInheritanceEnabled: true,
        onSave: () => undefined,
        store,
    }
    const editor = new ConfigEditor({ manager })
    // the manager fields are picked up by `when` reactions that only fire once
    // the values are observed; set them directly for the test
    editor.parentConfig = parentConfig
    editor.parentVariableId = 1
    editor.etlConfig = etlConfig
    editor.isInheritanceEnabled = true
    return editor
}

describe("ConfigEditor inheritance", () => {
    it("merges the indicator, ETL and patch layers in that order", () => {
        const editor = makeEditor()
        expect(editor.originalGrapherConfig).toEqual(
            mergeGrapherConfigs(parentConfig, etlConfig, patchConfig)
        )
    })

    it("applies the ETL layer even when indicator inheritance is off", () => {
        const editor = makeEditor()
        editor.isInheritanceEnabled = false
        expect(editor.activeParentConfig).toEqual(etlConfig)
    })

    it("reports a property as inherited when a layer supplies it and the patch doesn't", () => {
        const editor = makeEditor()
        editor.updateLiveGrapher(editor.originalGrapherConfig)
        expect(editor.isPropertyInherited("note")).toBe(true)
        expect(editor.isPropertyInherited("hasMapTab")).toBe(true)
        expect(editor.isPropertyInherited("title")).toBe(false)
    })

    it("re-fetches the indicator config through the store when the parent indicator changes", async () => {
        const loadIndicatorConfig = vi.fn(async (id: number) =>
            id === 2 ? { note: "Other indicator note" } : undefined
        )
        const store: IndicatorStore = {
            loadTable: async () => undefined,
            loadIndicatorConfig,
            toEditorConfig: (c) => c,
            fromEditorConfig: (c) => c,
        }
        const editor = makeEditor(store)
        editor.updateLiveGrapher(editor.originalGrapherConfig)

        editor.grapherState.setDimensionsFromConfigs([
            { property: DimensionProperty.y, variableId: 2 },
        ])
        await editor.updateParentConfig()

        expect(loadIndicatorConfig).toHaveBeenCalledWith(2)
        expect(editor.parentVariableId).toBe(2)
        expect(editor.parentConfig).toEqual({ note: "Other indicator note" })
        // the ETL layer and the admin's own override survive the swap
        expect(editor.liveConfig.title).toBe("Admin title")
        expect(editor.liveConfig.hasMapTab).toBe(true)
    })

    it("does nothing when the store cannot look indicator configs up", async () => {
        const editor = makeEditor()
        editor.grapherState.setDimensionsFromConfigs([
            { property: DimensionProperty.y, variableId: 2 },
        ])
        await editor.updateParentConfig()
        expect(editor.parentVariableId).toBe(1)
        expect(editor.parentConfig).toEqual(parentConfig)
    })
})
