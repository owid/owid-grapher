/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import { runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"

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
    editor.savedPatchConfig = editor.patchConfig
    return editor
}

describe(ConfigEditor, () => {
    it("runs without an admin", () => {
        const editor = makeEditor()
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
