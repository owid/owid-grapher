/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import { GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { ChartEditor, ChartEditorManager } from "./ChartEditor.js"

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

function makeEditor(): ChartEditor {
    const editor = new ChartEditor({
        manager: {
            admin: {} as any,
            patchConfig,
            parentConfig,
            etlConfig,
            isInheritanceEnabled: true,
            logs: [],
            references: undefined,
            redirects: [],
        } as unknown as ChartEditorManager,
    })
    // the manager fields are picked up by `when` reactions that only fire once
    // the values are observed; set them directly for the test
    editor.parentConfig = parentConfig
    editor.etlConfig = etlConfig
    editor.isInheritanceEnabled = true
    return editor
}

describe("ChartEditor parent stack", () => {
    it("applies the ETL layer above the indicator config", () => {
        const editor = makeEditor()
        expect(editor.activeParentConfig).toEqual({
            note: "Indicator note",
            subtitle: "Indicator subtitle",
            title: "ETL title",
            hasMapTab: true,
        })
    })

    it("keeps the ETL layer applied when inheritance is disabled", () => {
        const editor = makeEditor()
        editor.isInheritanceEnabled = false

        // the indicator layer drops out, the chart's own ETL layer does not
        expect(editor.activeParentConfig).toEqual({
            title: "ETL title",
            hasMapTab: true,
        })
    })

    it("does not write ETL-owned fields into the patch when rebuilding", () => {
        const editor = makeEditor()

        // seed the live grapher the way the editor does on load: it holds the
        // rendered config, and the patch is derived back out of it
        editor.updateLiveGrapher(
            mergeGrapherConfigs(editor.activeParentConfig ?? {}, patchConfig)
        )
        expect(editor.patchConfig.title).toBe("Admin title")
        // owned by the ETL layer, so not an admin override
        expect(editor.patchConfig.hasMapTab).toBeUndefined()

        // What `onToggleInheritance` does: capture the admin's overrides, flip
        // the flag, then rebuild from the whole parent stack.
        const capturedPatch = editor.patchConfig
        editor.isInheritanceEnabled = false
        editor.updateLiveGrapher(
            mergeGrapherConfigs(editor.activeParentConfig ?? {}, capturedPatch)
        )

        // The ETL layer still applies, and — the actual regression — it has not
        // been demoted into the patch. Merging only the indicator layer here
        // would leave `hasMapTab` out; `updateLiveGrapher` resets
        // grapherState first, so it would fall back to the grapher default and
        // the next save would store that default as an explicit admin override
        // of a field the ETL layer owns.
        expect(editor.fullConfig.hasMapTab).toBe(true)
        expect(editor.patchConfig.hasMapTab).toBeUndefined()
        expect(editor.patchConfig.title).toBe("Admin title")
        // the indicator layer is gone, as intended
        expect(editor.fullConfig.note).toBeUndefined()
    })
})
