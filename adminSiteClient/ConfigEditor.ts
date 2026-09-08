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
 * `extraTabs`, `renderSaveButtons` and `extensions` rather than subclassing,
 * so the editor itself stays free of chart ids, revisions and tags.
 */

import type { ReactNode } from "react"
import { comparer, computed, makeObservable, reaction, runInAction } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    EditorTab,
    References,
} from "./AbstractChartEditor.js"

/** A tab the host adds to the editor, rendered with the live editor. */
export interface EditorExtraTab {
    key: string
    label: ReactNode
    render: (editor: ConfigEditor) => ReactNode
}

/** Small hooks into the generic tabs for things only some hosts have. */
export interface EditorExtensions {
    /** Rendered at the end of the Basic tab (the admin puts tags here). */
    basicTabFooter?: (editor: ConfigEditor) => ReactNode
    /** Rendered at the end of the Text tab. */
    textTabFooter?: (editor: ConfigEditor) => ReactNode
    /** Extra suggestions for the origin URL field, shown first. */
    originUrlSuggestions?: { value: string; label: string; suffix?: string }[]
    /** Who last changed the map colour scale, shown on the Map tab. */
    lastMapColorScaleEdit?: { userName: string; createdAt: string }
    /** Where the "View chart" link above the preview points. Absent → no link. */
    previewUrl?: (editor: ConfigEditor) => string | undefined
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
    onChange?: (config: GrapherInterface) => void
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
    extensions?: EditorExtensions
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

    protected override get extraTabKeys(): string[] {
        return (this.manager.extraTabs ?? []).map((tab) => tab.key)
    }

    @computed get availableTabs(): string[] {
        const tabs: string[] = ["basic", "data", "text", "customize"]
        if (this.grapherState.hasMapTab) tabs.push("map")
        if (this.grapherState.isScatter) tabs.push("scatter")
        if (this.grapherState.isMarimekko) tabs.push("marimekko")
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
