/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import {
    DimensionProperty,
    GrapherInterface,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    ChartEditor,
    ChartEditorManager,
    Log,
    makeRestoredPatchConfig,
} from "./ChartEditor.js"

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
const etlConfig: GrapherInterface = { hasMapTab: true }
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

describe("ChartEditor restoreRevision", () => {
    it("loads the revision over the current parent configs without saving", async () => {
        const editor = makeSavedEditor()

        await editor.restoreRevision(
            makeLog({
                dimensions: yDimensionFor(SAVED_INDICATOR_ID),
                title: "Old title",
            })
        )

        expect(editor.patchConfig.title).toBe("Old title")
        expect(editor.patchConfig.hasMapTab).toBeUndefined()
        expect(editor.liveConfig.hasMapTab).toBe(true)
        expect(editor.liveConfig.note).toBe("Indicator 3 note")
        expect(editor.savedPatchConfig.title).toBe("Saved title")
        expect(editor.isModified).toBe(true)
    })

    it("switches the parent config when the revision uses another indicator", async () => {
        const editor = makeSavedEditor()

        await editor.restoreRevision(
            makeLog({ dimensions: yDimensionFor(OTHER_INDICATOR_ID) })
        )

        expect(editor.parentVariableId).toBe(OTHER_INDICATOR_ID)
        expect(editor.parentConfig).toEqual(
            indicatorConfigs[OTHER_INDICATOR_ID]
        )
        expect(editor.liveConfig.note).toBe("Indicator 7 note")
    })

    it("drops a restored field that equals the new indicator's value", async () => {
        const editor = makeSavedEditor()

        await editor.restoreRevision(
            makeLog({
                dimensions: yDimensionFor(OTHER_INDICATOR_ID),
                note: "Indicator 7 note",
                subtitle: "Indicator 3 subtitle",
            })
        )

        expect(editor.patchConfig.note).toBeUndefined()
        expect(editor.patchConfig.subtitle).toBe("Indicator 3 subtitle")
    })

    it("drops the indicator config when the revision has no single indicator", async () => {
        const editor = makeSavedEditor()

        await editor.restoreRevision(
            makeLog({
                dimensions: [
                    ...yDimensionFor(SAVED_INDICATOR_ID),
                    ...yDimensionFor(OTHER_INDICATOR_ID),
                ],
            })
        )

        expect(editor.parentVariableId).toBeUndefined()
        expect(editor.parentConfig).toBeUndefined()
        expect(editor.liveConfig.note).toBeUndefined()
    })

    it("keeps the indicator named by the ETL layer's dimensions", async () => {
        const editor = makeSavedEditor({
            etlConfig: {
                ...etlConfig,
                dimensions: yDimensionFor(SAVED_INDICATOR_ID),
            },
            savedPatch: { title: "Saved title" },
        })

        await editor.restoreRevision(makeLog({ title: "Old title" }))

        expect(editor.parentVariableId).toBe(SAVED_INDICATOR_ID)
        expect(editor.liveConfig.note).toBe("Indicator 3 note")
    })
})

describe("ChartEditor discardUnsavedChanges", () => {
    it("switches back to the saved indicator's config", async () => {
        const editor = makeSavedEditor()
        await editor.restoreRevision(
            makeLog({ dimensions: yDimensionFor(OTHER_INDICATOR_ID) })
        )

        await editor.discardUnsavedChanges()

        expect(editor.parentVariableId).toBe(SAVED_INDICATOR_ID)
        expect(editor.parentConfig).toEqual(
            indicatorConfigs[SAVED_INDICATOR_ID]
        )
        expect(editor.liveConfig.note).toBe("Indicator 3 note")
        expect(editor.isModified).toBe(false)
    })
})

/** An editor that has just loaded `savedPatch` on indicator 3 */
function makeSavedEditor({
    etlConfig: chartEtlConfig = etlConfig,
    savedPatch: chartSavedPatch = savedPatch,
}: {
    etlConfig?: GrapherInterface
    savedPatch?: GrapherInterface
} = {}): ChartEditor {
    const parentConfig = indicatorConfigs[SAVED_INDICATOR_ID]
    const editor = new ChartEditor({
        manager: {
            admin: { getJSON: fetchIndicatorConfig },
            patchConfig: chartSavedPatch,
            parentConfig,
            parentVariableId: SAVED_INDICATOR_ID,
            etlConfig: chartEtlConfig,
            isInheritanceEnabled: true,
            logs: [],
            references: undefined,
            redirects: [],
        } as unknown as ChartEditorManager,
    })
    // the manager fields are picked up by `when` reactions that only fire once
    // the values are observed; set them directly for the test
    editor.parentConfig = parentConfig
    editor.parentVariableId = SAVED_INDICATOR_ID
    editor.etlConfig = chartEtlConfig
    editor.isInheritanceEnabled = true
    vi.spyOn(editor, "reloadGrapherData").mockResolvedValue()

    editor.updateLiveGrapher(
        mergeGrapherConfigs(editor.activeParentConfig ?? {}, chartSavedPatch)
    )
    editor.savedPatchConfig = editor.patchConfig
    return editor
}

async function fetchIndicatorConfig(url: string): Promise<GrapherInterface> {
    const match = url.match(/^\/api\/variables\/(\d+)\.config\.json$/)
    const config = match && indicatorConfigs[Number(match[1])]
    if (!config) throw new Error(`Unexpected fetch: ${url}`)
    return config
}

function makeLog(config: GrapherInterface): Log {
    return {
        userId: 1,
        userName: "Restorer",
        createdAt: "2026-01-01T00:00:00Z",
        config: { $schema: latestGrapherConfigSchema, ...config },
    }
}

function yDimensionFor(variableId: number): OwidChartDimensionInterface[] {
    return [{ property: DimensionProperty.y, variableId }]
}
