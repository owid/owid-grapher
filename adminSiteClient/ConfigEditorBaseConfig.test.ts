/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import { observable, runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import * as _ from "lodash-es"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"

// The editor knows one thing about inheritance: `baseConfig` is the config the
// patch is diffed against. These cases cover the ways the base changes under an
// open editor (it arrives late, the host swaps it, it goes away, a loaded patch
// brings its own) and check both the live config and the patch a save would
// send, since either can go wrong on its own.

const withoutSchema = (config: GrapherInterface): GrapherInterface =>
    _.omit(config, "$schema")

const savedBase: GrapherInterface = {
    note: "Base note",
    subtitle: "Base subtitle",
    hasMapTab: true,
}
const otherBase: GrapherInterface = {
    note: "Other base note",
    subtitle: "Other base subtitle",
}
const savedPatch: GrapherInterface = { title: "Saved title" }

/** An editor that has just opened `savedPatch` over `initialBaseConfig` */
function makeEditor({
    initialBaseConfig = savedBase,
}: { initialBaseConfig?: GrapherInterface | null } = {}): {
    editor: ConfigEditor
    manager: ConfigEditorManager
} {
    const manager = observable<ConfigEditorManager>({
        patchConfig: savedPatch,
        baseConfig: initialBaseConfig ?? undefined,
        onSave: () => undefined,
    })
    const editor = new ConfigEditor({ manager })
    vi.spyOn(editor, "reloadGrapherData").mockResolvedValue()
    editor.updateLiveGrapher(editor.originalGrapherConfig)
    editor.markAsSaved()
    return { editor, manager }
}

describe("ConfigEditor with a base config", () => {
    it("starts from the base with the patch applied on top", () => {
        const { editor } = makeEditor()
        expect(withoutSchema(editor.originalGrapherConfig)).toEqual({
            title: "Saved title",
            note: "Base note",
            subtitle: "Base subtitle",
            hasMapTab: true,
        })
    })

    it("reports a property as inherited when the base supplies it and the patch doesn't", () => {
        const { editor } = makeEditor()
        expect(editor.isPropertyInherited("note")).toBe(true)
        expect(editor.isPropertyInherited("hasMapTab")).toBe(true)
        expect(editor.isPropertyInherited("title")).toBe(false)
    })

    it("saves only the difference to the base", () => {
        const { editor } = makeEditor()
        runInAction(() => {
            editor.grapherState.note = "My own note"
        })
        expect(withoutSchema(editor.patchConfig)).toEqual({
            title: "Saved title",
            note: "My own note",
        })
    })

    it("re-applies a swapped base underneath the user's edits", () => {
        const { editor, manager } = makeEditor()
        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })

        runInAction(() => {
            manager.baseConfig = { note: "Other base note", hasMapTab: true }
        })

        expect(editor.baseConfig).toEqual({
            note: "Other base note",
            hasMapTab: true,
        })
        expect(editor.liveConfig.title).toBe("Edited title")
        expect(editor.liveConfig.subtitle).toBeUndefined()
        expect(editor.liveConfig.note).toBe("Other base note")
        expect(withoutSchema(editor.patchConfig)).toEqual({
            title: "Edited title",
        })
    })

    it("applies a base that arrives after the editor opened", () => {
        const { editor, manager } = makeEditor({ initialBaseConfig: null })
        runInAction(() => {
            editor.grapherState.title = "Edited title"
        })

        runInAction(() => {
            manager.baseConfig = { hasMapTab: true, tab: "map" }
        })

        expect(editor.liveConfig.hasMapTab).toBe(true)
        expect(editor.liveConfig.tab).toBe("map")
        expect(withoutSchema(editor.patchConfig)).toEqual({
            title: "Edited title",
        })
    })

    it("treats the config as the whole config when the base goes away", () => {
        const { editor, manager } = makeEditor()
        runInAction(() => {
            manager.baseConfig = undefined
        })
        expect(editor.baseConfig).toBeUndefined()
        expect(withoutSchema(editor.patchConfig)).toEqual({
            title: "Saved title",
        })
    })

    it("treats an empty base as no base", () => {
        const { editor, manager } = makeEditor()
        runInAction(() => {
            manager.baseConfig = {}
        })
        expect(editor.baseConfig).toBeUndefined()
        expect(editor.isPropertyInherited("hasMapTab")).toBe(false)
    })
})

describe("ConfigEditor loadPatchConfig", () => {
    it("loads the patch over the current base without saving", async () => {
        const { editor } = makeEditor()

        await editor.loadPatchConfig({ title: "Old title" })

        expect(editor.patchConfig.title).toBe("Old title")
        expect(editor.liveConfig.note).toBe("Base note")
        expect(editor.savedPatchConfig.title).toBe("Saved title")
        expect(editor.isModified).toBe(true)
    })

    it("diffs the loaded patch against the base it is given", async () => {
        const { editor } = makeEditor()

        await editor.loadPatchConfig(
            { note: "Other base note", subtitle: "Base subtitle" },
            otherBase
        )

        expect(editor.liveConfig.note).toBe("Other base note")
        expect(editor.patchConfig.note).toBeUndefined()
        expect(editor.patchConfig.subtitle).toBe("Base subtitle")
    })

    it("leaves the patch as is when the host then hands down the same base", async () => {
        const { editor, manager } = makeEditor()
        await editor.loadPatchConfig(
            { subtitle: "Base subtitle" },
            otherBase
        )

        runInAction(() => {
            manager.baseConfig = otherBase
        })

        expect(editor.patchConfig.subtitle).toBe("Base subtitle")
        expect(editor.liveConfig.note).toBe("Other base note")
    })

    it("discards unsaved changes by loading the saved patch over the saved base", async () => {
        const { editor } = makeEditor()
        await editor.loadPatchConfig({ title: "Old title" }, otherBase)

        await editor.loadPatchConfig(editor.savedPatchConfig, savedBase)

        expect(editor.liveConfig.note).toBe("Base note")
        expect(editor.liveConfig.title).toBe("Saved title")
        expect(editor.isModified).toBe(false)
    })
})
