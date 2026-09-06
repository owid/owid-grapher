/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { createElement } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { EditorDebugTab } from "./EditorDebugTab.js"
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
const patchConfig: GrapherInterface = {
    title: "Admin title",
    dimensions: [{ property: DimensionProperty.y, variableId: 101 }],
}

function makeEditor(): ChartEditor {
    const editor = new ChartEditor({
        manager: {
            admin: {},
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

        render(createElement(EditorDebugTab, { editor }))
        fireEvent.click(
            screen.getByRole("checkbox", { name: "Enable inheritance" })
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

afterEach(() => vi.restoreAllMocks())

// Actions are real; only API transport and window creation are controlled.
function loadEditor(
    patch: GrapherInterface = patchConfig,
    parent: GrapherInterface = parentConfig,
    isInheritanceEnabled = true
): ChartEditor {
    const editor = new ChartEditor({
        manager: {
            admin: {
                requestJSON: vi.fn(),
                getJSON: vi.fn(),
                url: (path: string) => path,
            },
            patchConfig: patch,
            parentConfig: parent,
            parentVariableId: 101,
            etlConfig,
            isInheritanceEnabled,
            logs: [],
            references: undefined,
            redirects: [],
        } as unknown as ChartEditorManager,
    })
    editor.updateLiveGrapher(editor.originalGrapherConfig)
    editor.savedPatchConfig = patch
    return editor
}

describe("ChartEditor action lifecycle", () => {
    it("saves and reopens a disabled inheritance stack without demoting ETL settings", async () => {
        const editor = loadEditor({ ...patchConfig, id: 42 })
        render(createElement(EditorDebugTab, { editor }))
        fireEvent.click(
            screen.getByRole("checkbox", { name: "Enable inheritance" })
        )
        const savedPatch: GrapherInterface = {
            $schema: latestGrapherConfigSchema,
            id: 42,
            title: "Admin title",
            dimensions: [{ property: DimensionProperty.y, variableId: 101 }],
        }
        vi.mocked(editor.manager.admin.requestJSON).mockResolvedValue({
            success: true,
            savedPatch,
            newLog: {},
        })
        await editor.saveGrapher()
        const [url, payload] = vi.mocked(editor.manager.admin.requestJSON).mock
            .calls[0]
        expect(url).toBe(
            "/api/charts/42?inheritance=disable&forceDatapage=false"
        )
        expect(payload).toMatchObject(savedPatch)
        for (const key of ["note", "subtitle", "hasMapTab"])
            expect(payload).not.toHaveProperty(key)
        const reopened = loadEditor(
            payload as GrapherInterface,
            parentConfig,
            false
        )
        expect(reopened.fullConfig.title).toBe("Admin title")
        expect(reopened.fullConfig.hasMapTab).toBe(true)
        expect(reopened.fullConfig.note).toBeUndefined()
        expect(reopened.fullConfig.subtitle).toBeUndefined()
        expect(editor.isModified).toBe(false)
        editor.dispose()
        reopened.dispose()
    })

    it("changes parent, saves only overrides, and reconstructs the saved configuration", async () => {
        const editor = loadEditor({ ...patchConfig, id: 42 })
        const newParent = {
            note: "New indicator note",
            subtitle: "New indicator subtitle",
        }
        vi.mocked(editor.manager.admin.getJSON).mockResolvedValue(newParent)
        editor.grapherState.updateFromObject({
            dimensions: [{ property: DimensionProperty.y, variableId: 202 }],
        })
        await editor.updateParentConfig()
        expect(editor.manager.admin.getJSON).toHaveBeenCalledWith(
            "/api/variables/202.config.json"
        )
        expect(editor.fullConfig).toMatchObject({
            title: "Admin title",
            note: "New indicator note",
            subtitle: "New indicator subtitle",
            hasMapTab: true,
        })
        const savedPatch: GrapherInterface = {
            $schema: latestGrapherConfigSchema,
            id: 42,
            title: "Admin title",
            dimensions: [{ property: DimensionProperty.y, variableId: 202 }],
        }
        vi.mocked(editor.manager.admin.requestJSON).mockResolvedValue({
            success: true,
            savedPatch,
            newLog: {},
        })
        await editor.saveGrapher()
        const [url, payload, method] = vi.mocked(
            editor.manager.admin.requestJSON
        ).mock.calls[0]
        expect(url).toBe(
            "/api/charts/42?inheritance=enable&forceDatapage=false"
        )
        expect(method).toBe("PUT")
        expect(payload).toMatchObject(savedPatch)
        for (const key of ["note", "subtitle", "hasMapTab"])
            expect(payload).not.toHaveProperty(key)
        expect(editor.patchConfig).toEqual({
            ...savedPatch,
            version: editor.grapherState.version,
        })
        expect(editor.isModified).toBe(false)
        const reopened = loadEditor(payload as GrapherInterface, newParent)
        expect(reopened.fullConfig).toMatchObject({
            title: "Admin title",
            note: "New indicator note",
            subtitle: "New indicator subtitle",
            hasMapTab: true,
            dimensions: [{ property: DimensionProperty.y, variableId: 202 }],
        })
        editor.dispose()
        reopened.dispose()
    })

    it("copies effective ETL settings without the original identity or publication", async () => {
        const editor = loadEditor({
            ...patchConfig,
            id: 42,
            slug: "original",
            isPublished: true,
        })
        const assign = vi.fn()
        vi.spyOn(window, "open").mockReturnValue({
            location: { assign },
        } as unknown as Window)
        vi.mocked(editor.manager.admin.requestJSON).mockResolvedValue({
            success: true,
            chartId: 99,
        })
        await editor.saveAsNewGrapher()
        const [url, payload, method] = vi.mocked(
            editor.manager.admin.requestJSON
        ).mock.calls[0]
        expect(url).toBe("/api/charts?inheritance=enable&forceDatapage=false")
        expect(method).toBe("POST")
        expect(payload).toMatchObject({
            title: "Admin title",
            hasMapTab: true,
            note: "Indicator note",
            subtitle: "Indicator subtitle",
        })
        for (const key of ["id", "slug", "isPublished"])
            expect(payload).not.toHaveProperty(key)
        expect(assign).toHaveBeenCalledWith("charts/99/edit")
        expect(editor.grapherState.id).toBe(42)
        expect(editor.grapherState.isPublished).toBe(true)
        editor.dispose()
    })

    it("keeps unsaved changes and the saved baseline when the API rejects a save", async () => {
        const editor = loadEditor({
            ...patchConfig,
            id: 42,
            isPublished: false,
        })
        const baseline = editor.savedPatchConfig
        const version = editor.grapherState.version
        editor.grapherState.title = "Unsaved title"
        vi.mocked(editor.manager.admin.requestJSON).mockResolvedValue({
            success: false,
        })
        const onError = vi.fn()
        await editor.saveGrapher({ onError })
        expect(onError).toHaveBeenCalledOnce()
        expect(editor.savedPatchConfig).toEqual(baseline)
        expect(editor.isModified).toBe(true)
        expect(editor.grapherState.version).toBe(version)
        expect(editor.grapherState.isPublished).toBe(false)
        expect(editor.logs).toEqual([])
        editor.dispose()
    })
})
