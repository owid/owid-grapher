/* ConfigEditor.ts
 * ===============
 *
 * The chart editor with no notion of a chart record: it takes a grapher
 * config, lets the user edit it against a live preview, and hands the edited
 * config back through `onSave`. Where the config comes from and where it goes
 * is the host's business — the admin's charts table, a YAML file in ETL, a
 * JSON file in someone else's repo.
 *
 * Hosts that do have a chart record (the admin) plug their extras in through
 * `extraTabs` and `renderSaveButtons` rather than subclassing, so the editor
 * itself stays free of chart ids, revisions and tags.
 */

import type { ReactNode } from "react"
import { comparer, computed, makeObservable, reaction, runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    EditorTab,
} from "./AbstractChartEditor.js"

/** A tab the host adds to the editor, rendered with the live editor. */
export interface EditorExtraTab {
    key: string
    label: ReactNode
    render: (editor: ConfigEditor) => ReactNode
}

export interface ConfigEditorManager extends AbstractChartEditorManager {
    /**
     * Receives the edited config in the host's form (see `IndicatorStore`).
     * May return the config as the host actually stored it; the editor then
     * treats that as the saved state instead of what it sent.
     */
    onSave: (
        config: GrapherInterface,
        editor: ConfigEditor
    ) => void | GrapherInterface | Promise<void | GrapherInterface>
    /** Fires on every change of the edited config, in the host's form. */
    onChange?: (config: GrapherInterface, editor: ConfigEditor) => void
    /**
     * Restrict which tabs the editor shows. Tabs that don't apply to the
     * chart type (map, scatter, marimekko) are hidden regardless.
     */
    tabs?: EditorTab[]
    /** Host tabs, shown after the chart-type tabs and before Export. */
    extraTabs?: EditorExtraTab[]
    /** Replaces the default "Save config" button. */
    renderSaveButtons?: (
        editor: ConfigEditor,
        editingErrors: string[]
    ) => ReactNode
}

export class ConfigEditor extends AbstractChartEditor<ConfigEditorManager> {
    constructor(props: { manager: ConfigEditorManager }) {
        super(props)
        makeObservable(this)

        this.disposers.push(
            reaction(
                () => this.hostConfig,
                (config) => this.manager.onChange?.(config, this),
                { equals: comparer.structural }
            ),
            // The host swapped the base config (e.g. the admin fetched the
            // defaults of a newly picked indicator). Re-apply it underneath
            // the user's edits: capture the patch against the *old* base
            // first, otherwise values the old base supplied would be folded
            // into the patch as if the user had authored them.
            reaction(
                () => this.manager.parentConfig,
                (base) => {
                    const { patchConfig } = this
                    runInAction(() => {
                        this.parentConfig = base
                    })
                    this.updateLiveGrapher(
                        mergeGrapherConfigs(
                            this.activeParentConfig ?? {},
                            patchConfig
                        )
                    )
                },
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

    protected override get extraTabKeys(): string[] {
        return (this.manager.extraTabs ?? []).map((tab) => tab.key)
    }

    @computed get availableTabs(): string[] {
        const tabs: string[] = ["basic", "data", "text", "customize"]
        if (this.grapherState.hasMapTab) tabs.push("map")
        // `has*`, not `is*`: a chart can carry a scatter or Marimekko as a
        // secondary type, and that tab must still be reachable.
        if (this.grapherState.hasScatter) tabs.push("scatter")
        if (this.grapherState.hasMarimekko) tabs.push("marimekko")
        tabs.push(...this.extraTabKeys)
        tabs.push("export", "debug")

        const allowed = this.manager.tabs as string[] | undefined
        return allowed
            ? tabs.filter(
                  (tab) =>
                      allowed.includes(tab) || this.extraTabKeys.includes(tab)
              )
            : tabs
    }

    get isNewGrapher(): boolean {
        return false
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { patchConfig, hostConfig } = this
        let saved: GrapherInterface | void
        try {
            saved = await this.manager.onSave(hostConfig, this)
        } catch {
            onError?.()
            return
        }
        runInAction(() => {
            this.savedPatchConfig = saved
                ? this.store.toEditorConfig(saved)
                : patchConfig
        })
    }
}

export function isConfigEditorInstance(
    editor: AbstractChartEditor
): editor is ConfigEditor {
    return editor instanceof ConfigEditor
}
