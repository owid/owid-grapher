/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import { observable, runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import * as _ from "lodash-es"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"

// the editor always stamps the schema onto the patch; not what these tests are about
const withoutSchema = (config: GrapherInterface): GrapherInterface =>
    _.omit(config, "$schema")

// A base the patch sits on. The admin builds it from an indicator's config
// and the chart's ETL layer; the editor only ever sees the merged result.
const baseConfig: GrapherInterface = {
    note: "Base note",
    subtitle: "Base subtitle",
    hasMapTab: true,
}
const patchConfig: GrapherInterface = { title: "Patch title" }

function makeEditor(): {
    editor: ConfigEditor
    manager: ConfigEditorManager
} {
    // observable, so that changing `parentConfig` later reaches the editor
    // the way a re-rendered `GrapherEditor` prop would
    const manager = observable<ConfigEditorManager>({
        patchConfig,
        parentConfig: baseConfig,
        isInheritanceEnabled: true,
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
            manager.parentConfig = { note: "Other base note", hasMapTab: true }
        })

        expect(editor.parentConfig).toEqual({
            note: "Other base note",
            hasMapTab: true,
        })
        // the edit survives, the old base's subtitle is gone, the new note shows
        expect(editor.liveConfig.title).toBe("Edited title")
        expect(editor.liveConfig.subtitle).toBeUndefined()
        expect(editor.liveConfig.note).toBe("Other base note")
        // and the old base's values were not folded into the patch
        expect(withoutSchema(editor.patchConfig)).toEqual({
            title: "Edited title",
        })
    })

    it("treats the config as the whole config when the base goes away", () => {
        const { editor, manager } = makeEditor()
        runInAction(() => {
            manager.parentConfig = undefined
        })
        expect(editor.activeParentConfig).toBeUndefined()
        expect(withoutSchema(editor.patchConfig)).toEqual({
            title: "Patch title",
        })
    })
})
