/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import { observable, runInAction } from "mobx"
import {
    DimensionProperty,
    GrapherInterface,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { makeRestoredPatchConfig } from "./adminChartApi.js"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"

const SAVED_INDICATOR_ID = 3
const OTHER_INDICATOR_ID = 7
const indicatorConfigs: Record<number, GrapherInterface> = {
    [SAVED_INDICATOR_ID]: {
        note: "Indicator 3 note",
        subtitle: "Indicator 3 subtitle",
    },
    [OTHER_INDICATOR_ID]: {
        note: "Indicator 7 note",
        subtitle: "Indicator 7 subtitle",
    },
}
const savedPatch: GrapherInterface = {
    dimensions: yDimensionFor(SAVED_INDICATOR_ID),
    title: "Saved title",
}

describe(makeRestoredPatchConfig, () => {
    it("migrates the revision to the latest schema", () => {
        const restored = makeRestoredPatchConfig(
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
                map: { projection: "Europe" },
            },
            {}
        )

        expect(restored.map).toEqual({ region: "Europe" })
    })

    it("keeps the current id, version, slug and publishing state", () => {
        const restored = makeRestoredPatchConfig(
            {
                $schema: latestGrapherConfigSchema,
                id: 1,
                version: 5,
                slug: "old-slug",
                isPublished: false,
                title: "Old title",
            },
            {
                id: 2,
                version: 9,
                slug: "current-slug",
                isPublished: true,
                title: "Current title",
            }
        )

        expect(restored).toEqual({
            $schema: latestGrapherConfigSchema,
            id: 2,
            version: 9,
            slug: "current-slug",
            isPublished: true,
            title: "Old title",
        })
    })

    it("drops a kept key the current patch doesn't have", () => {
        const restored = makeRestoredPatchConfig(
            {
                $schema: latestGrapherConfigSchema,
                slug: "old-slug",
                isPublished: true,
                title: "Old title",
            },
            { title: "Current title" }
        )

        expect(restored).toEqual({
            $schema: latestGrapherConfigSchema,
            title: "Old title",
        })
    })
})

describe("ConfigEditor loadPatchConfig", () => {
    it("loads the patch over the current base without saving", async () => {
        const { editor } = makeSavedEditor()

        await editor.loadPatchConfig({
            dimensions: yDimensionFor(SAVED_INDICATOR_ID),
            title: "Old title",
        })

        expect(editor.patchConfig.title).toBe("Old title")
        expect(editor.liveConfig.note).toBe("Indicator 3 note")
        expect(editor.savedPatchConfig.title).toBe("Saved title")
        expect(editor.isModified).toBe(true)
    })

    it("applies the patch over the base it is given", async () => {
        const { editor } = makeSavedEditor()

        await editor.loadPatchConfig(
            { dimensions: yDimensionFor(OTHER_INDICATOR_ID) },
            indicatorConfigs[OTHER_INDICATOR_ID]
        )

        expect(editor.parentConfig).toEqual(
            indicatorConfigs[OTHER_INDICATOR_ID]
        )
        expect(editor.liveConfig.note).toBe("Indicator 7 note")
    })

    it("keeps a patch value that only the old base had", async () => {
        const { editor } = makeSavedEditor()

        await editor.loadPatchConfig(
            {
                dimensions: yDimensionFor(OTHER_INDICATOR_ID),
                note: "Indicator 7 note",
                subtitle: "Indicator 3 subtitle",
            },
            indicatorConfigs[OTHER_INDICATOR_ID]
        )

        expect(editor.patchConfig.note).toBeUndefined()
        expect(editor.patchConfig.subtitle).toBe("Indicator 3 subtitle")
    })

    it("leaves the patch as is when the host then hands down the same base", async () => {
        const { editor, manager } = makeSavedEditor()
        await editor.loadPatchConfig(
            {
                dimensions: yDimensionFor(OTHER_INDICATOR_ID),
                subtitle: "Indicator 3 subtitle",
            },
            indicatorConfigs[OTHER_INDICATOR_ID]
        )

        runInAction(() => {
            manager.parentConfig = indicatorConfigs[OTHER_INDICATOR_ID]
        })

        expect(editor.patchConfig.subtitle).toBe("Indicator 3 subtitle")
        expect(editor.liveConfig.note).toBe("Indicator 7 note")
    })

    it("discards unsaved changes by loading the saved patch over the saved base", async () => {
        const { editor } = makeSavedEditor()
        await editor.loadPatchConfig(
            { dimensions: yDimensionFor(OTHER_INDICATOR_ID) },
            indicatorConfigs[OTHER_INDICATOR_ID]
        )

        await editor.loadPatchConfig(
            editor.savedPatchConfig,
            indicatorConfigs[SAVED_INDICATOR_ID]
        )

        expect(editor.liveConfig.note).toBe("Indicator 3 note")
        expect(editor.isModified).toBe(false)
    })
})

/** An editor that has just loaded `savedPatch` on indicator 3 */
function makeSavedEditor(): {
    editor: ConfigEditor
    manager: ConfigEditorManager
} {
    // observable, so that changing `parentConfig` later reaches the editor
    // the way a re-rendered `GrapherEditor` prop would
    const manager = observable<ConfigEditorManager>({
        patchConfig: savedPatch,
        parentConfig: indicatorConfigs[SAVED_INDICATOR_ID],
        isInheritanceEnabled: true,
        onSave: () => undefined,
    })
    const editor = new ConfigEditor({ manager })
    vi.spyOn(editor, "reloadGrapherData").mockResolvedValue()

    editor.updateLiveGrapher(editor.originalGrapherConfig)
    editor.savedPatchConfig = editor.patchConfig
    return { editor, manager }
}

function yDimensionFor(variableId: number): OwidChartDimensionInterface[] {
    return [{ property: DimensionProperty.y, variableId }]
}
