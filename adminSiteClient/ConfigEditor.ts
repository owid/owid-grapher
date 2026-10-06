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
 * after the part of the config that section edits
 */
export type EditorNoteSlot = "map.colorScale"

/** One entry in the editor's "Origin url" dropdown. */
export interface OriginUrlSuggestion {
    url: string
    /** Why this URL is being offered, shown greyed after it. */
    hint?: string
}

export type EditorTabKey = EditorTabName | EditorExtraTab["key"]

export interface EditorExtraTab {
    key: string
    label: ReactNode
    render: (editor: ConfigEditor) => ReactNode
}

export interface ConfigEditorManager {
    environment?: EditorEnvironment
    store?: IndicatorStore
    patchConfig: GrapherInterface
    baseConfig?: GrapherInterface
    scatterDefaults?: ScatterDefaults
    renderNote?: (slot: EditorNoteSlot) => ReactNode
    originUrlSuggestions?: () => OriginUrlSuggestion[]
    onSave: (
        config: GrapherInterface,
        editor: ConfigEditor
    ) => void | GrapherInterface | Promise<void | GrapherInterface>
    onChange?: (config: GrapherInterface, editor: ConfigEditor) => void
    /**
     * Restrict which tabs the editor shows. Tabs that don't apply to the
     * chart type (map, scatter, marimekko) are hidden regardless.
     */
    tabs?: EditorTabName[]
    /** Host tabs, shown after the chart-type tabs and before Export. */
    extraTabs?: EditorExtraTab[]
    renderSaveButtons?: (
        editor: ConfigEditor,
        editingErrors: string[]
    ) => ReactNode
}

export class ConfigEditor {
    manager: ConfigEditorManager

    grapherState: GrapherState
    store: IndicatorStore
    currentRequest: Promise<any> | undefined
    tab: EditorTabKey = "basic"
    errorMessage: { title: string; content: string } | undefined = undefined
    previewMode: "mobile" | "desktop"
    showStaticPreview = false
    savedPatchConfig: GrapherInterface = {}

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
            reaction(
                () => this.manager.baseConfig,
                (baseConfig) => this.rebaseEdits(baseConfig),
                { equals: comparer.structural }
            )
        )
    }

    @action.bound private rebaseEdits(
        baseConfig: GrapherInterface | undefined
    ): void {
        const { patchConfig } = this
        this.baseConfig = nonEmptyConfig(baseConfig)
        this.updateLiveGrapher(
            mergeGrapherConfigs(this.baseConfig ?? {}, patchConfig)
        )
        void this.reloadGrapherData()
    }

    @action.bound markAsSaved(
        savedPatch: GrapherInterface = this.patchConfig
    ): void {
        this.savedPatchConfig = savedPatch
    }

    private get extraTabKeys(): EditorTabKey[] {
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

    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig } = this.manager
        const baseConfig = nonEmptyConfig(this.manager.baseConfig)
        return baseConfig
            ? mergeGrapherConfigs(baseConfig, patchConfig)
            : patchConfig
    }

    @computed get liveConfig(): GrapherInterface {
        return this.grapherState.object
    }

    @computed get liveConfigWithDefaults(): GrapherInterface {
        return mergeGrapherConfigs(defaultGrapherConfig, this.liveConfig)
    }

    @computed get fullConfig(): GrapherInterface {
        if (!this.baseConfig) return this.liveConfig
        return mergeGrapherConfigs(this.baseConfig, this.patchConfig)
    }

    @computed get baseConfigWithDefaults(): GrapherInterface | undefined {
        if (!this.baseConfig) return undefined
        return mergeGrapherConfigs(defaultGrapherConfig, this.baseConfig)
    }

    @computed get patchConfig(): GrapherInterface {
        return diffGrapherConfigs(
            this.liveConfigWithDefaults,
            this.baseConfigWithDefaults ?? defaultGrapherConfig
        )
    }

    private configsDiffer(a: GrapherInterface, b: GrapherInterface): boolean {
        const userAuthored = (config: GrapherInterface): unknown =>
            withoutUndefinedValues(_.omit(config, HOST_STAMPED_KEYS))

        return !_.isEqual(userAuthored(a), userAuthored(b))
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

    isPropertyInherited(property: keyof GrapherInterface): boolean {
        if (!this.baseConfigWithDefaults) return false
        return (
            !Object.hasOwn(this.patchConfig, property) &&
            Object.hasOwn(this.baseConfigWithDefaults, property)
        )
    }

    canPropertyBeInherited(property: keyof GrapherInterface): boolean {
        if (!this.baseConfig) return false
        return Object.hasOwn(this.baseConfig, property)
    }

    @computed get invalidFocusedSeriesNames(): SeriesName[] {
        const { grapherState } = this

        if (!this.features.canHighlightSeries) {
            return grapherState.focusArray.seriesNames
        }

        const availableSeriesNames = grapherState.focusableSeriesNames
        const focusedSeriesNames = grapherState.focusArray.seriesNames
        return _.difference(focusedSeriesNames, availableSeriesNames)
    }

    @computed get invalidSelectedEntityNames(): SeriesName[] {
        const { grapherState } = this

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

    private latestReloadId = 0

    @action.bound async reloadGrapherData(): Promise<void> {
        const { grapherState } = this
        const reloadId = ++this.latestReloadId
        const inputTable = await this.store.loadTable(
            grapherState.dimensionConfigs,
            grapherState.selectedEntityColors
        )
        if (inputTable && reloadId === this.latestReloadId)
            grapherState.inputTable = inputTable
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

    @computed get availableTabs(): EditorTabKey[] {
        const tabs: EditorTabKey[] = ["basic", "data", "text", "customize"]
        if (this.grapherState.hasMapTab) tabs.push("map")
        if (this.grapherState.hasScatter) tabs.push("scatter")
        if (this.grapherState.hasMarimekko) tabs.push("marimekko")
        tabs.push(...this.extraTabKeys)
        tabs.push("export", "debug")

        const allowed: EditorTabKey[] | undefined = this.manager.tabs
        return allowed
            ? tabs.filter(
                  (tab) =>
                      allowed.includes(tab) || this.extraTabKeys.includes(tab)
              )
            : tabs
    }

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
            if (this.configsDiffer(savedPatch, patchConfig))
                this.updateLiveGrapher(
                    mergeGrapherConfigs(this.baseConfig ?? {}, savedPatch)
                )
            this.markAsSaved(savedPatch)
        })
    }
}

const HOST_STAMPED_KEYS = [
    "version",
    "id",
] as const satisfies readonly (keyof GrapherInterface)[]

function withoutUndefinedValues(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value))
}

function nonEmptyConfig(
    config: GrapherInterface | undefined
): GrapherInterface | undefined {
    return config && !_.isEmpty(config) ? config : undefined
}
