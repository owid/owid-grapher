import * as _ from "lodash-es"
import {
    GrapherInterface,
    diffGrapherConfigs,
    mergeGrapherConfigs,
    PostReference,
    SeriesName,
} from "@ourworldindata/utils"
import {
    ContentGraphLinkType,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import {
    action,
    computed,
    observable,
    when,
    makeObservable,
    reaction,
    IReactionDisposer,
} from "mobx"
import { EditorFeatures } from "./EditorFeatures.js"
import { Admin } from "./Admin.js"
import {
    defaultGrapherConfig,
    getCachingInputTableFetcher,
    GrapherState,
    loadCatalogData,
} from "@ourworldindata/grapher"
import { NarrativeChartMinimalInformation } from "./ChartEditor.js"
import { IndicatorChartInfo } from "./IndicatorChartEditor.js"
import { DataInsightMinimalInformation } from "../adminShared/AdminTypes.js"
import { CATALOG_URL, DATA_API_URL } from "../settings/clientSettings.js"

const EDITOR_TABS = [
    "basic",
    "data",
    "text",
    "customize",
    "map",
    "scatter",
    "marimekko",
    "revisions",
    "refs",
    "export",
    "debug",
] as const

export type EditorTab = (typeof EDITOR_TABS)[number]

function isValidEditorTab(tab: string): tab is EditorTab {
    return EDITOR_TABS.includes(tab as EditorTab)
}

export interface AbstractChartEditorManager {
    admin: Admin
    patchConfig: GrapherInterface
    // For the main chart editor, `parentConfig` is the indicator's grapher_config
    // (variable.grapherConfigETL). For other editor variants (indicator/narrative)
    // it is whatever their parent layer happens to be.
    parentConfig?: GrapherInterface
    // For the main chart editor, the chart's own ETL-authored grapher config
    // (stored as a separate chart_configs row, via charts.configIdETL). Always
    // applied, independent of indicator inheritance. Undefined for editors that
    // don't have this layer.
    etlConfig?: GrapherInterface
    isInheritanceEnabled?: boolean
    variableIdsByCatalogPath?: Record<string, number | null>
}

export interface References {
    postsWordpress?: PostReference[]
    postsGdocs?: PostReference[]
    explorers?: string[]
    narrativeCharts?: NarrativeChartMinimalInformation[]
    childCharts?: IndicatorChartInfo[]
    dataInsights?: DataInsightMinimalInformation[]
    staticViz?: StaticVizReference[]
}

export interface StaticVizReference {
    id: number
    name: string
    grapherSlug?: string | null
    type: ContentGraphLinkType.StaticViz
}

export abstract class AbstractChartEditor<
    Manager extends AbstractChartEditorManager = AbstractChartEditorManager,
> {
    manager: Manager

    grapherState = new GrapherState({
        additionalDataLoaderFn: (catalogKey) =>
            loadCatalogData(catalogKey, { baseUrl: CATALOG_URL }),
    })
    cachingGrapherDataLoader = getCachingInputTableFetcher(
        DATA_API_URL,
        undefined,
        true
    )
    currentRequest: Promise<any> | undefined // Whether the current chart state is saved or not
    tab: EditorTab = "basic"
    errorMessage: { title: string; content: string } | undefined = undefined
    previewMode: "mobile" | "desktop"
    showStaticPreview = false
    savedPatchConfig: GrapherInterface = {}

    // parent config derived from the current chart config
    parentConfig: GrapherInterface | undefined = undefined
    // chart's own ETL-authored grapher config layer (above parentConfig,
    // below patchConfig in the merge chain). Always applied — independent of
    // `isInheritanceEnabled`, which only governs `parentConfig`.
    etlConfig: GrapherInterface | undefined = undefined
    // if inheritance is enabled, the parent config is applied to grapherState
    isInheritanceEnabled: boolean | undefined = undefined

    private readonly disposers: IReactionDisposer[] = []

    constructor(props: { manager: Manager }) {
        makeObservable(this, {
            grapherState: observable.ref,
            currentRequest: observable.ref,
            tab: observable.ref,
            errorMessage: observable.ref,
            previewMode: observable.ref,
            showStaticPreview: observable.ref,
            savedPatchConfig: observable.ref,
            parentConfig: observable.ref,
            etlConfig: observable.ref,
            isInheritanceEnabled: observable.ref,
        })
        this.manager = props.manager
        this.previewMode =
            localStorage.getItem("editorPreviewMode") === "mobile"
                ? "mobile"
                : "desktop"

        this.readInitialTabFromUrl()
        this.setupTabUrlSync()

        when(
            () => this.manager.parentConfig !== undefined,
            () => (this.parentConfig = this.manager.parentConfig)
        )

        when(
            () => this.manager.etlConfig !== undefined,
            () => (this.etlConfig = this.manager.etlConfig)
        )

        when(
            () => this.manager.isInheritanceEnabled !== undefined,
            () =>
                (this.isInheritanceEnabled = this.manager.isInheritanceEnabled)
        )

        when(
            () => this.grapherState.hasData && this.grapherState.isReady,
            () => (this.savedPatchConfig = this.patchConfig)
        )
    }

    private readInitialTabFromUrl(): void {
        const urlParams = new URLSearchParams(window.location.search)
        const tabParam = urlParams.get("tab")
        if (tabParam && isValidEditorTab(tabParam)) this.tab = tabParam
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

    abstract get references(): References | undefined

    @computed get variableIdsByCatalogPath():
        | Record<string, number | null>
        | undefined {
        return this.manager.variableIdsByCatalogPath
    }

    /** original grapher config used to init the grapherState instance */
    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig, parentConfig, etlConfig, isInheritanceEnabled } =
            this.manager
        const effectiveParent = mergeGrapherConfigs(
            isInheritanceEnabled ? (parentConfig ?? {}) : {},
            etlConfig ?? {}
        )
        if (_.isEmpty(effectiveParent)) return patchConfig
        return mergeGrapherConfigs(effectiveParent, patchConfig)
    }

    /** live-updating config */
    @computed get liveConfig(): GrapherInterface {
        return this.grapherState.object
    }

    @computed get liveConfigWithDefaults(): GrapherInterface {
        return mergeGrapherConfigs(defaultGrapherConfig, this.liveConfig)
    }

    /** patch config merged with parent config */
    @computed get fullConfig(): GrapherInterface {
        if (!this.activeParentConfig) return this.liveConfig
        return mergeGrapherConfigs(this.activeParentConfig, this.patchConfig)
    }

    /** parent config currently applied to grapher.
     *
     * Combines the indicator's grapher_config (if `isInheritanceEnabled`) with
     * the chart's own etlConfig (always applied). Returns undefined only if
     * neither layer contributes anything.
     */
    @computed get activeParentConfig(): GrapherInterface | undefined {
        const variablePart = this.isInheritanceEnabled
            ? (this.parentConfig ?? {})
            : {}
        const etlPart = this.etlConfig ?? {}
        if (_.isEmpty(variablePart) && _.isEmpty(etlPart)) return undefined
        return mergeGrapherConfigs(variablePart, etlPart)
    }

    @computed get activeParentConfigWithDefaults():
        | GrapherInterface
        | undefined {
        if (!this.activeParentConfig) return undefined
        return mergeGrapherConfigs(
            defaultGrapherConfig,
            this.activeParentConfig
        )
    }

    /** patch config of the chart that is written to the db on save */
    @computed get patchConfig(): GrapherInterface {
        return diffGrapherConfigs(
            this.liveConfigWithDefaults,
            this.activeParentConfigWithDefaults ?? defaultGrapherConfig
        )
    }

    @computed get isModified(): boolean {
        // Serialize and deserialize to remove all MobX proxies
        // (toJS does not do a deep conversion of nested objects)
        const currentPatch = JSON.parse(
            JSON.stringify(_.omit(this.patchConfig, "version"))
        )
        const savedPatch = JSON.parse(
            JSON.stringify(_.omit(this.savedPatchConfig, "version"))
        )

        return !_.isEqual(currentPatch, savedPatch)
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
        // A property is "inherited" when the active parent (variableConfig
        // if inheritance is on, plus etlConfig if any) supplies it AND the
        // chart's patch doesn't override it.
        if (!this.activeParentConfigWithDefaults) return false
        return (
            !Object.hasOwn(this.patchConfig, property) &&
            Object.hasOwn(this.activeParentConfigWithDefaults, property)
        )
    }

    // only works for top-level properties
    canPropertyBeInherited(property: keyof GrapherInterface): boolean {
        if (!this.activeParentConfig) return false
        return Object.hasOwn(this.activeParentConfig, property)
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
        const inputTable = await this.cachingGrapherDataLoader(
            grapherState.dimensions,
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
            dimensions: grapherState.dimensions.map((dim) => dim.toObject()),
        })
        grapherState.seriesColorMap?.clear()
        await this.reloadGrapherData()
    }

    abstract get isNewGrapher(): boolean
    abstract get availableTabs(): EditorTab[]

    abstract saveGrapher(props?: { onError?: () => void }): Promise<void>
}
