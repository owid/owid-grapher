/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { runInAction } from "mobx"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"
import { IndicatorStore } from "./indicatorStores.js"

function makeEditor(
    overrides: Partial<ConfigEditorManager> = {}
): ConfigEditor {
    const manager: ConfigEditorManager = {
        patchConfig: { title: "Original title", hasMapTab: true },
        onSave: () => undefined,
        ...overrides,
        store: overrides.store ?? { loadTable: async () => undefined },
    }
    const editor = new ConfigEditor({ manager })
    editor.updateLiveGrapher(manager.patchConfig)
    editor.markAsSaved()
    return editor
}

describe(ConfigEditor, () => {
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
        const editor = makeEditor({ tabs: ["basic", "text"] })
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
            onSave: (config, ed) => {
                runInAction(() => {
                    ed.grapherState.id = 4711
                })
                return config
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

    it("adopts a config the host normalized on save", async () => {
        const editor = makeEditor({
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

    it("keeps an edit made while a save is in flight", async () => {
        let finishSave: (saved: GrapherInterface) => void = () => undefined
        const editor = makeEditor({
            onSave: (config) =>
                new Promise((resolve) => {
                    finishSave = () =>
                        resolve({ ...config, subtitle: "Normalized" })
                }),
        })
        runInAction(() => {
            editor.grapherState.title = "Saved title"
        })

        const saving = editor.saveGrapher()
        runInAction(() => {
            editor.grapherState.title = "Typed while saving"
        })
        finishSave({})
        await saving

        expect(editor.grapherState.title).toBe("Typed while saving")
        expect(editor.isModified).toBe(true)
    })

    it("reloads the data when the host saves a config with other indicators", async () => {
        const loadTable = vi.fn<IndicatorStore["loadTable"]>(
            async () => undefined
        )
        const editor = makeEditor({
            store: { loadTable },
            onSave: (config) => ({
                ...config,
                dimensions: [{ property: DimensionProperty.y, variableId: 2 }],
            }),
        })
        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })

        await editor.saveGrapher()

        expect(loadTable.mock.lastCall?.[0]).toMatchObject([{ variableId: 2 }])
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

    it("tells the host when unsaved changes appear and when a save clears them", async () => {
        const onModifiedChange = vi.fn<(isModified: boolean) => void>()
        const editor = makeEditor({ onModifiedChange })
        // makeEditor marks its starting config as saved
        onModifiedChange.mockClear()

        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })
        runInAction(() => {
            editor.grapherState.title = "Edited title, again"
        })
        await editor.saveGrapher()

        expect(onModifiedChange.mock.calls).toEqual([[true], [false]])
    })
})

describe("ConfigEditor tab in the URL", () => {
    const urlWithTab = "/charts/1/edit?tab=text"
    const editors: ConfigEditor[] = []
    const makeTrackedEditor = (
        manager?: Partial<ConfigEditorManager>
    ): ConfigEditor => {
        const editor = makeEditor(manager)
        editors.push(editor)
        return editor
    }
    afterEach(() => {
        editors.splice(0).forEach((editor) => editor.dispose())
        window.history.replaceState({}, "", "/")
    })

    it("leaves the host page's URL alone by default", () => {
        window.history.replaceState({}, "", urlWithTab)
        const editor = makeTrackedEditor()
        expect(editor.tab).toBe("basic")

        runInAction(() => {
            editor.tab = "customize"
        })
        expect(window.location.search).toBe("?tab=text")
    })

    it("ignores a tab in the URL that the host doesn't show", () => {
        window.history.replaceState({}, "", "/charts/1/edit?tab=map")
        const editor = makeTrackedEditor({
            syncTabWithUrl: true,
            tabs: ["basic", "text"],
        })
        expect(editor.tab).toBe("basic")
    })

    it("keeps the page's history state when it writes the tab", () => {
        window.history.replaceState({ routerKey: "abc" }, "", urlWithTab)
        const editor = makeTrackedEditor({ syncTabWithUrl: true })

        runInAction(() => {
            editor.tab = "customize"
        })
        expect(window.history.state).toEqual({ routerKey: "abc" })
    })

    it("opens on the URL's tab and keeps it updated when the host syncs it", () => {
        window.history.replaceState({}, "", urlWithTab)
        const editor = makeTrackedEditor({ syncTabWithUrl: true })
        expect(editor.tab).toBe("text")

        runInAction(() => {
            editor.tab = "customize"
        })
        expect(window.location.search).toBe("?tab=customize")
    })
})

function makeControlledStore(): {
    store: IndicatorStore
    resolveLoad: (index: number, table: OwidTable | undefined) => void
} {
    const pendingLoads: ((table: OwidTable | undefined) => void)[] = []
    return {
        store: {
            loadTable: () =>
                new Promise((resolve) => pendingLoads.push(resolve)),
        },
        resolveLoad: (index, table) => pendingLoads[index](table),
    }
}

const tableWithValue = (value: number): OwidTable =>
    new OwidTable(`entityName,year,population\nFrance,2000,${value}`)

describe("ConfigEditor reloadGrapherData", () => {
    const patchConfig: GrapherInterface = {
        dimensions: [{ property: DimensionProperty.y, variableId: 1 }],
    }

    it("keeps a table that arrives after a later reload found nothing new", async () => {
        const { store, resolveLoad } = makeControlledStore()
        const editor = makeEditor({ store, patchConfig })
        const table = tableWithValue(1)

        const firstReload = editor.reloadGrapherData()
        const repeatReload = editor.reloadGrapherData()
        resolveLoad(1, undefined)
        await repeatReload
        resolveLoad(0, table)
        await firstReload

        expect(editor.grapherState.inputTable).toBe(table)
    })

    it("doesn't let an older reload's table replace a newer one", async () => {
        const { store, resolveLoad } = makeControlledStore()
        const editor = makeEditor({ store, patchConfig })
        const olderTable = tableWithValue(1)
        const newerTable = tableWithValue(2)

        const olderReload = editor.reloadGrapherData()
        const newerReload = editor.reloadGrapherData()
        resolveLoad(1, newerTable)
        await newerReload
        resolveLoad(0, olderTable)
        await olderReload

        expect(editor.grapherState.inputTable).toBe(newerTable)
    })
})
