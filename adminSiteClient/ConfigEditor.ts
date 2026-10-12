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

const HOST_STAMPED_KEYS = [
    "version",
    "id",
] as const satisfies readonly (keyof GrapherInterface)[]

export type EditorTabName = (typeof EDITOR_TAB_NAMES)[number]

export interface EditorExtraTab {
    key: string
    label: ReactNode
    render: (editor: ConfigEditor) => ReactNode
}

export type EditorTabKey = EditorTabName | EditorExtraTab["key"]

/**
 * Places inside the editor where the host may add a note of its own, named
 * after the part of the config that section edits
 */
export type EditorNoteSlot = "map.colorScale"

/** One entry in the editor's "Origin url" dropdown */
export interface OriginUrlSuggestion {
    url: string
    hint?: string
}

export interface ConfigEditorManager {
    patchConfig: GrapherInterface
    baseConfig?: GrapherInterface

    store?: IndicatorStore
    environment?: EditorEnvironment
    scatterDefaults?: OwidChartDimensionInterface[]

    onSave: (
        config: GrapherInterface,
        editor: ConfigEditor
    ) => void | GrapherInterface | Promise<void | GrapherInterface>
    onChange?: (config: GrapherInterface, editor: ConfigEditor) => void

    tabs?: EditorTabName[]
    extraTabs?: EditorExtraTab[]
    renderSaveButtons?: (
        editor: ConfigEditor,
        editingErrors: string[]
    ) => ReactNode

    renderNote?: (slot: EditorNoteSlot) => ReactNode
    originUrlSuggestions?: OriginUrlSuggestion[]
}

export class ConfigEditor {
    manager: ConfigEditorManager
    store: IndicatorStore

    grapherState: GrapherState
    baseConfig: GrapherInterface | undefined = undefined
    savedPatchConfig: GrapherInterface = {}

    tab: EditorTabKey
    previewMode: "mobile" | "desktop" = "desktop"
    showStaticPreview = false

    private readonly disposers: IReactionDisposer[] = []
    private latestReloadId = 0
    private latestAppliedReloadId = 0

    constructor(props: { manager: ConfigEditorManager }) {
        this.manager = props.manager
        const environment = this.manager.environment ?? defaultEditorEnvironment
        this.store =
            this.manager.store ??
            dataApiIndicatorStore({ dataApiUrl: environment.dataApiUrl })

        this.grapherState = new GrapherState({
            additionalDataLoaderFn: (catalogKey) =>
                loadCatalogData(catalogKey, {
                    baseUrl: environment.catalogUrl,
                }),
        })
        this.baseConfig = nonEmptyConfig(this.manager.baseConfig)

        this.tab = this.tabFromUrl() ?? "basic"

        makeObservable(this, {
            grapherState: observable.ref,
            baseConfig: observable.ref,
            savedPatchConfig: observable.ref,
            tab: observable.ref,
            previewMode: observable.ref,
            showStaticPreview: observable.ref,
        })

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
            ),
            reaction(
                () => this.tab,
                (tab) => writeTabToUrl(tab)
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

    private tabFromUrl(): EditorTabKey | undefined {
        const tabParam = new URLSearchParams(window.location.search).get("tab")
        if (
            tabParam &&
            (EDITOR_TAB_NAMES.includes(tabParam as EditorTabName) ||
                this.extraTabKeys.includes(tabParam))
        )
            return tabParam
        return undefined
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
        const withoutUndefinedValues = (value: unknown): unknown =>
            JSON.parse(JSON.stringify(value))
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

    @action.bound async reloadGrapherData(): Promise<void> {
        const { grapherState } = this
        const reloadId = ++this.latestReloadId
        const inputTable = await this.store.loadTable(
            grapherState.dimensionConfigs,
            grapherState.selectedEntityColors
        )
        if (inputTable && reloadId > this.latestAppliedReloadId) {
            this.latestAppliedReloadId = reloadId
            grapherState.inputTable = inputTable
        }
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

function nonEmptyConfig(
    config: GrapherInterface | undefined
): GrapherInterface | undefined {
    return config && !_.isEmpty(config) ? config : undefined
}

function writeTabToUrl(tab: EditorTabKey): void {
    const url = new URL(window.location.href)
    if (tab === "basic") url.searchParams.delete("tab")
    else url.searchParams.set("tab", tab)
    window.history.replaceState({}, "", url.toString())
}
