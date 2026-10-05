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

import * as _ from "lodash-es"
import type { ReactNode } from "react"
import {
    action,
    comparer,
    computed,
    IReactionDisposer,
    makeObservable,
    observable,
    reaction,
    runInAction,
} from "mobx"
import {
    GrapherInterface,
    OwidChartDimensionInterface,
    SeriesName,
} from "@ourworldindata/types"
import { diffGrapherConfigs, mergeGrapherConfigs } from "@ourworldindata/utils"
import {
    defaultGrapherConfig,
    GrapherState,
    loadCatalogData,
} from "@ourworldindata/grapher"
import { EditorFeatures } from "./EditorFeatures.js"
import {
    defaultEditorEnvironment,
    EditorEnvironment,
    ScatterDefaults,
} from "./editorProviders.js"
import { dataApiIndicatorStore, IndicatorStore } from "./indicatorStores.js"

const EDITOR_TAB_NAMES = [
    "basic",
    "data",
    "text",
    "customize",
    "map",
    "scatter",
    "marimekko",
    "export",
    "debug",
] as const

export type EditorTabName = (typeof EDITOR_TAB_NAMES)[number]

/**
 * Places inside the editor where the host may add a note of its own, named
 * after the part of the config that section edits. The admin uses
 * `map.colorScale` to say who last touched the map's colors, which it reads
 * off the chart's revision log — something only a host with a revision log
 * can know. Opening a new slot means adding a member here and a call site in
 * the section that renders it.
 */
export type EditorNoteSlot = "map.colorScale"

/** One entry in the editor's "Origin url" dropdown. */
export interface OriginUrlSuggestion {
    url: string
    /** Why this URL is being offered, shown greyed after it. */
    hint?: string
}

/** A tab the host adds to the editor, rendered with the live editor. */
export interface EditorExtraTab {
    key: string
    label: ReactNode
    render: (editor: ConfigEditor) => ReactNode
}

export interface ConfigEditorManager {
    // URLs the editor loads indicator data from. Defaults to the admin's.
    environment?: EditorEnvironment
    // Where indicator data and metadata come from. Defaults to OWID's Data
    // API at `environment.dataApiUrl`.
    store?: IndicatorStore
    patchConfig: GrapherInterface
    /** The config `patchConfig` is a patch against, if any */
    baseConfig?: GrapherInterface
    scatterDefaults?: ScatterDefaults
    /**
     * Extra context to show next to one part of the config. Called while the
     * section renders, so a note that depends on data the host is still
     * loading (or has just changed) appears on its own.
     */
    renderNote?: (slot: EditorNoteSlot) => ReactNode
    /**
     * URLs to offer for the chart's "Origin url". Which pages exist and
     * which of them already show this chart is the host's knowledge, not the
     * editor's; a host that offers none gets a plain text field. Called
     * while the field renders, so suggestions still loading appear on their
     * own.
     */
    originUrlSuggestions?: () => OriginUrlSuggestion[]
    /**
     * Receives the edited config. May return the config as the host actually
     * stored it; the editor then treats that as the saved state instead of
     * what it sent.
     */
    onSave: (
        config: GrapherInterface,
        editor: ConfigEditor
    ) => void | GrapherInterface | Promise<void | GrapherInterface>
    /** Fires on every change of the edited config. */
    onChange?: (config: GrapherInterface, editor: ConfigEditor) => void
    /**
     * Restrict which tabs the editor shows. Tabs that don't apply to the
     * chart type (map, scatter, marimekko) are hidden regardless.
     */
    tabs?: EditorTabName[]
    /** Host tabs, shown after the chart-type tabs and before Export. */
    extraTabs?: EditorExtraTab[]
    /** Replaces the default "Save config" button. */
    renderSaveButtons?: (
        editor: ConfigEditor,
        editingErrors: string[]
    ) => ReactNode
}

export class ConfigEditor {
    manager: ConfigEditorManager

    grapherState: GrapherState
    store: IndicatorStore
    currentRequest: Promise<any> | undefined // Whether the current chart state is saved or not
    // One of EDITOR_TAB_NAMES, or a key of a tab the host added (`extraTabKeys`)
    tab: string = "basic"
    errorMessage: { title: string; content: string } | undefined = undefined
    previewMode: "mobile" | "desktop"
    showStaticPreview = false
    savedPatchConfig: GrapherInterface = {}

    /** The base the live config currently sits on; never an empty config */
    baseConfig: GrapherInterface | undefined = undefined

    private readonly disposers: IReactionDisposer[] = []

    constructor(props: { manager: ConfigEditorManager }) {
        const environment =
            props.manager.environment ?? defaultEditorEnvironment
        this.grapherState = new GrapherState({
            additionalDataLoaderFn: (catalogKey) =>
                loadCatalogData(catalogKey, {
                    baseUrl: environment.catalogUrl,
                }),
        })
        this.store =
            props.manager.store ??
            dataApiIndicatorStore({ dataApiUrl: environment.dataApiUrl })

        makeObservable(this, {
            grapherState: observable.ref,
            currentRequest: observable.ref,
            tab: observable.ref,
            errorMessage: observable.ref,
            previewMode: observable.ref,
            showStaticPreview: observable.ref,
            savedPatchConfig: observable.ref,
            baseConfig: observable.ref,
        })
        this.manager = props.manager
        this.previewMode =
            localStorage.getItem("editorPreviewMode") === "mobile"
                ? "mobile"
                : "desktop"

        this.readInitialTabFromUrl()
        this.setupTabUrlSync()

        this.baseConfig = nonEmptyConfig(this.manager.baseConfig)

        this.disposers.push(
            reaction(
                () => this.patchConfig,
                (config) => this.manager.onChange?.(config, this),
                { equals: comparer.structural }
            ),
            // The host swapped the base config (e.g. the admin fetched the
            // defaults of a newly picked indicator). Re-apply it underneath
            // the user's edits: capture the patch against the *old* base
            // first, otherwise values the old base supplied would be folded
            // into the patch as if the user had authored them.
            reaction(
                () => this.manager.baseConfig,
                (baseConfig) => {
                    const { patchConfig } = this
                    runInAction(() => {
                        this.baseConfig = nonEmptyConfig(baseConfig)
                    })
                    this.updateLiveGrapher(
                        mergeGrapherConfigs(this.baseConfig ?? {}, patchConfig)
                    )
                    // A base that names columns of its own leaves the chart
                    // pointing at data the store hasn't fetched.
                    void this.reloadGrapherData()
                },
                { equals: comparer.structural }
            )
        )
    }

    /**
     * Take the config as it stands for the saved state, so what follows
     * counts as the user's edits. Called by the view once the host's config
     * (and its data, if it has any) is in, and again after every save.
     *
     * Not a `when` on `grapherState.isReady` in the constructor: a freshly
     * constructed, still empty GrapherState already reports itself ready, so
     * the baseline would be taken before the config is applied and every
     * chart would open modified.
     */
    @action.bound markAsSaved(): void {
        this.savedPatchConfig = this.patchConfig
    }

    /** Keys of tabs the host adds on top of EDITOR_TAB_NAMES */
    private get extraTabKeys(): string[] {
        return (this.manager.extraTabs ?? []).map((tab) => tab.key)
    }

    private readInitialTabFromUrl(): void {
        const urlParams = new URLSearchParams(window.location.search)
        const tabParam = urlParams.get("tab")
        if (
            tabParam &&
            (EDITOR_TAB_NAMES.includes(tabParam as EditorTabName) ||
                this.extraTabKeys.includes(tabParam))
        )
            this.tab = tabParam
    }

    private setupTabUrlSync(): void {
        this.disposers.push(
            reaction(
                () => this.tab,
                (tab) => {
                    const url = new URL(window.location.href)
                    if (tab === "basic") {
                        url.searchParams.delete("tab")
                    } else {
                        url.searchParams.set("tab", tab)
                    }
                    window.history.replaceState({}, "", url.toString())
                }
            )
        )
    }

    dispose(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    /** original grapher config used to init the grapherState instance */
    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig } = this.manager
        const baseConfig = nonEmptyConfig(this.manager.baseConfig)
        return baseConfig
            ? mergeGrapherConfigs(baseConfig, patchConfig)
            : patchConfig
    }

    /** live-updating config */
    @computed get liveConfig(): GrapherInterface {
        return this.grapherState.object
    }

    @computed get liveConfigWithDefaults(): GrapherInterface {
        return mergeGrapherConfigs(defaultGrapherConfig, this.liveConfig)
    }

    /** patch config merged with the base config */
    @computed get fullConfig(): GrapherInterface {
        if (!this.baseConfig) return this.liveConfig
        return mergeGrapherConfigs(this.baseConfig, this.patchConfig)
    }

    @computed get baseConfigWithDefaults(): GrapherInterface | undefined {
        if (!this.baseConfig) return undefined
        return mergeGrapherConfigs(defaultGrapherConfig, this.baseConfig)
    }

    /** patch config of the chart that is written to the db on save */
    @computed get patchConfig(): GrapherInterface {
        return diffGrapherConfigs(
            this.liveConfigWithDefaults,
            this.baseConfigWithDefaults ?? defaultGrapherConfig
        )
    }

    /** Do two configs differ in anything the user authored? */
    private configsDiffer(a: GrapherInterface, b: GrapherInterface): boolean {
        // `version` and `id` are bookkeeping the host stamps onto the config
        // on save, never something the user edited. Comparing them would
        // report a freshly created chart as modified the moment it gets its
        // id, which is exactly when the page redirects to it.
        const bookkeeping = ["version", "id"]
        // Serialize and deserialize to remove all MobX proxies
        // (toJS does not do a deep conversion of nested objects)
        const strip = (config: GrapherInterface): unknown =>
            JSON.parse(JSON.stringify(_.omit(config, bookkeeping)))

        return !_.isEqual(strip(a), strip(b))
    }

    @computed get isModified(): boolean {
        return this.configsDiffer(this.patchConfig, this.savedPatchConfig)
    }

    @computed get features(): EditorFeatures {
        return new EditorFeatures(this)
    }

    @action.bound updateLiveGrapher(config: GrapherInterface): void {
        this.grapherState.reset()
        this.grapherState.updateFromObject(config)
        this.grapherState.updateAuthoredVersion(config)
    }

    // only works for top-level properties
    isPropertyInherited(property: keyof GrapherInterface): boolean {
        if (!this.baseConfigWithDefaults) return false
        return (
            !Object.hasOwn(this.patchConfig, property) &&
            Object.hasOwn(this.baseConfigWithDefaults, property)
        )
    }

    // only works for top-level properties
    canPropertyBeInherited(property: keyof GrapherInterface): boolean {
        if (!this.baseConfig) return false
        return Object.hasOwn(this.baseConfig, property)
    }

    @computed get invalidFocusedSeriesNames(): SeriesName[] {
        const { grapherState } = this

        // If focusing is not supported, then all focused series are invalid
        if (!this.features.canHighlightSeries) {
            return grapherState.focusArray.seriesNames
        }

        // Find invalid focused series
        const availableSeriesNames = grapherState.focusableSeriesNames
        const focusedSeriesNames = grapherState.focusArray.seriesNames
        return _.difference(focusedSeriesNames, availableSeriesNames)
    }

    @computed get invalidSelectedEntityNames(): SeriesName[] {
        const { grapherState } = this

        // Find invalid selected entities
        const { availableEntityNames } = grapherState
        const selectedEntityNames = grapherState.selection.selectedEntityNames
        return _.difference(selectedEntityNames, availableEntityNames)
    }

    @action.bound removeInvalidFocusedSeriesNames(): void {
        this.grapherState.focusArray.remove(...this.invalidFocusedSeriesNames)
    }

    @action.bound removeInvalidSelectedEntityNames(): void {
        this.grapherState.selection.deselectEntities(
            this.invalidSelectedEntityNames
        )
    }

    @action.bound async reloadGrapherData(): Promise<void> {
        const { grapherState } = this
        const inputTable = await this.store.loadTable(
            grapherState.dimensionConfigs,
            grapherState.selectedEntityColors
        )
        if (inputTable) grapherState.inputTable = inputTable
    }

    @action.bound async commitDimensionsAndReloadData(
        newDimensions?: OwidChartDimensionInterface[]
    ): Promise<void> {
        const { grapherState } = this
        if (newDimensions) {
            grapherState.setDimensionsFromConfigs(newDimensions)
        }
        grapherState.updateAuthoredVersion({
            dimensions: grapherState.dimensionConfigs,
        })
        grapherState.seriesColorMap?.clear()
        await this.reloadGrapherData()
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

    /**
     * Load a patch into the live grapher without saving. Pass `baseConfig`
     * when the patch sits on a different base that the host has not handed
     * down yet; the host's base swap that follows then leaves the patch as is.
     */
    @action.bound async loadPatchConfig(
        patchConfig: GrapherInterface,
        baseConfig: GrapherInterface | undefined = this.baseConfig
    ): Promise<void> {
        this.baseConfig = nonEmptyConfig(baseConfig)
        this.updateLiveGrapher(
            mergeGrapherConfigs(this.baseConfig ?? {}, patchConfig)
        )
        await this.commitDimensionsAndReloadData()
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { patchConfig } = this
        let saved: GrapherInterface | void
        try {
            saved = await this.manager.onSave(patchConfig, this)
        } catch {
            onError?.()
            return
        }
        runInAction(() => {
            const savedPatch = saved ?? patchConfig
            // What the host stored may differ from what we sent it — the
            // admin fills in a title it derived from the data, for one. Show
            // that, or the chart reads as modified the moment it was saved.
            if (this.configsDiffer(savedPatch, patchConfig))
                this.updateLiveGrapher(
                    mergeGrapherConfigs(this.baseConfig ?? {}, savedPatch)
                )
            this.savedPatchConfig = savedPatch
        })
    }
}

/** Treats an empty base the same as no base */
function nonEmptyConfig(
    config: GrapherInterface | undefined
): GrapherInterface | undefined {
    return config && !_.isEmpty(config) ? config : undefined
}
