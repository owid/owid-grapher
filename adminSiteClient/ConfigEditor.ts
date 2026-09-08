/* ConfigEditor.ts
 * ===============
 *
 * The chart editor with no notion of a chart record: it takes a grapher
 * config, lets the user edit it against a live preview, and hands the edited
 * config back through `onSave`. Where the config comes from and where it goes
 * is the host's business — the admin's charts table, a YAML file in ETL, a
 * JSON file in someone else's repo.
 *
 * This is the editor the future npm package exposes. `ChartEditor` and
 * `NarrativeChartEditor` are the admin's own flavours, with saving, tags,
 * revisions and references wired to the admin API.
 */

import { comparer, computed, makeObservable, reaction, runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    EditorTab,
    References,
} from "./AbstractChartEditor.js"

export interface ConfigEditorManager extends AbstractChartEditorManager {
    /** Receives the patch config (the diff against `parentConfig`, if any). */
    onSave: (config: GrapherInterface) => void | Promise<void>
    /** Fires on every change of the patch config. */
    onChange?: (config: GrapherInterface) => void
    /**
     * Restrict which tabs the editor shows. Tabs that don't apply to the
     * chart type (map, scatter, marimekko) are hidden regardless.
     */
    tabs?: EditorTab[]
}

export class ConfigEditor extends AbstractChartEditor<ConfigEditorManager> {
    constructor(props: { manager: ConfigEditorManager }) {
        super(props)
        makeObservable(this)

        this.disposers.push(
            reaction(
                () => this.hostConfig,
                (config) => this.manager.onChange?.(config),
                { equals: comparer.structural }
            )
        )
    }

    /** The host's config, translated into the dimension-based form the
     *  editor works on (identity for the Data API store). */
    override get originalGrapherConfig(): GrapherInterface {
        return this.store.toEditorConfig(super.originalGrapherConfig)
    }

    /** The patch config in the host's own form: what `onSave` and
     *  `onChange` hand back. */
    @computed get hostConfig(): GrapherInterface {
        return this.store.fromEditorConfig(this.patchConfig)
    }

    get references(): References | undefined {
        return undefined
    }

    @computed get availableTabs(): EditorTab[] {
        const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
        if (this.grapherState.hasMapTab) tabs.push("map")
        // `has*`, not `is*`: a chart can carry a scatter or Marimekko as a
        // secondary type, and that tab must still be reachable.
        if (this.grapherState.hasScatter) tabs.push("scatter")
        if (this.grapherState.hasMarimekko) tabs.push("marimekko")
        tabs.push("export", "debug")

        const allowed = this.manager.tabs
        return allowed ? tabs.filter((tab) => allowed.includes(tab)) : tabs
    }

    get isNewGrapher(): boolean {
        return false
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { patchConfig, hostConfig } = this
        try {
            await this.manager.onSave(hostConfig)
        } catch {
            onError?.()
            return
        }
        runInAction(() => {
            this.savedPatchConfig = patchConfig
        })
    }
}

export function isConfigEditorInstance(
    editor: AbstractChartEditor
): editor is ConfigEditor {
    return editor instanceof ConfigEditor
}
