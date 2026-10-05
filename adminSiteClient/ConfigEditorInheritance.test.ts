/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import { observable, runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import * as _ from "lodash-es"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"

const withoutSchema = (config: GrapherInterface): GrapherInterface =>
    _.omit(config, "$schema")

const baseConfig: GrapherInterface = {
    note: "Base note",
    subtitle: "Base subtitle",
    hasMapTab: true,
}
const patchConfig: GrapherInterface = { title: "Patch title" }

function makeEditor({
    initialBaseConfig = baseConfig,
}: { initialBaseConfig?: GrapherInterface | null } = {}): {
    editor: ConfigEditor
    manager: ConfigEditorManager
} {
    const manager = observable<ConfigEditorManager>({
        patchConfig,
        baseConfig: initialBaseConfig ?? undefined,
        onSave: () => undefined,
    })
    const editor = new ConfigEditor({ manager })
    editor.updateLiveGrapher(editor.originalGrapherConfig)
    return { editor, manager }
}

describe("ConfigEditor with a base config", () => {
    it("starts from the base with the patch applied on top", () => {
        const { editor } = makeEditor()
        expect(editor.originalGrapherConfig).toEqual(
            mergeGrapherConfigs(baseConfig, patchConfig)
        )
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
            title: "Patch title",
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
            title: "Patch title",
        })
    })
})
