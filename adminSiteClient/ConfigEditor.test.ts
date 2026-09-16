/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import { runInAction } from "mobx"
import { ColumnTypeNames, GrapherInterface } from "@ourworldindata/types"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"
import { csvIndicatorStore } from "./indicatorStores.js"

function makeEditor(
    overrides: Partial<ConfigEditorManager> = {}
): ConfigEditor {
    const manager: ConfigEditorManager = {
        patchConfig: { title: "Original title", hasMapTab: true },
        isInheritanceEnabled: false,
        onSave: () => undefined,
        ...overrides,
    }
    const editor = new ConfigEditor({ manager })
    editor.updateLiveGrapher(manager.patchConfig)
    editor.markAsSaved()
    return editor
}

/** A store whose configs name columns by slug rather than by variable id. */
function makeCsvStore() {
    return csvIndicatorStore({
        csv: `entityName,year,rent_index,vacancy_rate,region
Berlin,2015,100,3.1,DE
Berlin,2020,131,1.2,DE`,
        name: "housing.csv",
        columnDefs: [
            { slug: "rent_index", type: ColumnTypeNames.Numeric },
            { slug: "vacancy_rate", type: ColumnTypeNames.Numeric },
        ],
    })
}

describe(ConfigEditor, () => {
    it("runs without an admin", () => {
        const editor = makeEditor()
        expect(editor.manager.admin).toBeUndefined()
        expect(editor.isNewGrapher).toBe(false)
    })

    it("shows the generic tabs, never the chart-record ones", () => {
        const editor = makeEditor()
        expect(editor.availableTabs).toEqual([
            "basic",
            "data",
            "text",
            "customize",
            "map",
            "export",
            "debug",
        ])
    })

    it("restricts tabs to the ones the host allows", () => {
        const editor = makeEditor({ tabs: ["basic", "text", "refs"] })
        // "refs" is not a config-editor tab, so asking for it changes nothing
        expect(editor.availableTabs).toEqual(["basic", "text"])
    })

    it("hands the patch config to onSave and marks the editor as saved", async () => {
        const onSave = vi.fn<(config: GrapherInterface) => void>()
        const editor = makeEditor({ onSave })

        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })
        expect(editor.isModified).toBe(true)

        await editor.saveGrapher()

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave.mock.calls[0][0]).toMatchObject({
            title: "Edited title",
            hasMapTab: true,
        })
        expect(editor.isModified).toBe(false)
    })

    it("does not count the id a host stamps on after creating a chart as an edit", async () => {
        const editor = makeEditor({
            // the host assigns the id the server handed back, like the admin
            // does for a new chart, and returns the stored patch without it
            onSave: (config, ed) => {
                runInAction(() => {
                    ed.grapherState.id = 4711
                })
                return config // what the server stored: the patch, sans id
            },
        })
        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })
        await editor.saveGrapher()
        expect(editor.grapherState.id).toBe(4711)
        expect(editor.isModified).toBe(false)
    })

    it("reports a failed save through onError and stays modified", async () => {
        const onError = vi.fn()
        const editor = makeEditor({
            onSave: () => {
                throw new Error("nope")
            },
        })

        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })
        await editor.saveGrapher({ onError })

        expect(onError).toHaveBeenCalledOnce()
        expect(editor.isModified).toBe(true)
    })

    it("takes the saved baseline from the applied config, not from an empty one", () => {
        const manager: ConfigEditorManager = {
            patchConfig: { title: "Original title", hasMapTab: true },
            isInheritanceEnabled: false,
            onSave: () => undefined,
        }
        const editor = new ConfigEditor({ manager })
        // A freshly constructed GrapherState already reports itself ready, so
        // a baseline taken at construction would be the empty one and every
        // chart would open modified.
        expect(editor.savedPatchConfig).toEqual({})

        // what the view does once the config and its data are in
        editor.grapherState.updateFromObject(editor.originalGrapherConfig)
        editor.markAsSaved()

        expect(editor.isModified).toBe(false)
    })

    it("adopts a config the host normalized on save", async () => {
        const editor = makeEditor({
            // the admin fills in a title it derived from the data
            onSave: (config) => ({ ...config, title: "Derived title" }),
            patchConfig: { subtitle: "A subtitle" },
        })
        runInAction(() => {
            editor.grapherState.subtitle = "An edited subtitle"
        })

        await editor.saveGrapher()

        expect(editor.grapherState.title).toBe("Derived title")
        expect(editor.isModified).toBe(false)
    })

    it("merges a slug-based base and patch in the host's own form", () => {
        const store = makeCsvStore()
        const editor = new ConfigEditor({
            manager: {
                store,
                patchConfig: { colorSlug: "region" },
                parentConfig: { ySlugs: "rent_index" },
                isInheritanceEnabled: true,
                onSave: () => undefined,
            },
        })
        // Translating the layers one by one would rebuild the dimensions from
        // the patch alone and drop the base's y column.
        expect(editor.originalGrapherConfig.dimensions).toEqual([
            { property: "y", variableId: 1 },
            { property: "color", variableId: 3 },
        ])
    })

    it("keeps a slug-based base's columns when the patch names none", () => {
        const store = makeCsvStore()
        const editor = new ConfigEditor({
            manager: {
                store,
                patchConfig: { title: "A title" },
                parentConfig: { ySlugs: "rent_index" },
                isInheritanceEnabled: true,
                onSave: () => undefined,
            },
        })
        // "names no columns → plot every numeric one" is about the chart as a
        // whole, so the base's column stands rather than being inferred over.
        expect(editor.originalGrapherConfig.dimensions).toEqual([
            { property: "y", variableId: 1 },
        ])
    })

    it("doesn't read columns into a saved patch that names none", async () => {
        const store = makeCsvStore()
        const editor = new ConfigEditor({
            manager: {
                store,
                patchConfig: { title: "A title" },
                parentConfig: { ySlugs: "rent_index" },
                isInheritanceEnabled: true,
                // the host stores the patch and hands it back
                onSave: (config) => config,
            },
        })
        editor.grapherState.updateFromObject(editor.originalGrapherConfig)
        editor.markAsSaved()

        await editor.saveGrapher()

        // inferring every numeric column from the returned patch would put
        // the base's column back into the patch as if the user had picked it
        expect(editor.hostConfig.ySlugs).toBeUndefined()
        expect(editor.isModified).toBe(false)
    })

    it("fires onChange with the new patch as the config is edited", () => {
        const onChange = vi.fn<(config: GrapherInterface) => void>()
        const editor = makeEditor({ onChange })

        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })

        expect(onChange).toHaveBeenCalled()
        expect(onChange.mock.lastCall?.[0]).toMatchObject({
            title: "Edited title",
        })
    })
})
