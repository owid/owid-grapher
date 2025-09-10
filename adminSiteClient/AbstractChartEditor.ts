import * as _ from "lodash-es"
import {
    GrapherInterface,
    diffGrapherConfigs,
    mergeGrapherConfigs,
    PostReference,
    SeriesName,
} from "@ourworldindata/utils"
import { action, computed, observable, when, makeObservable } from "mobx"
import { EditorFeatures } from "./EditorFeatures.js"
import { Admin } from "./Admin.js"
import {
    defaultGrapherConfig,
    getCachingInputTableFetcher,
    GrapherState,
    loadVariableDataAndMetadata,
} from "@ourworldindata/grapher"
import { NarrativeChartMinimalInformation } from "./ChartEditor.js"
import { IndicatorChartInfo } from "./IndicatorChartEditor.js"
import { DataInsightMinimalInformation } from "../adminShared/AdminTypes.js"
import { DATA_API_URL } from "../settings/clientSettings.js"

export type EditorTab =
    | "basic"
    | "data"
    | "text"
    | "customize"
    | "map"
    | "scatter"
    | "marimekko"
    | "revisions"
    | "refs"
    | "export"
    | "debug"

export interface AbstractChartEditorManager {
    admin: Admin
    patchConfig: GrapherInterface
    parentConfig?: GrapherInterface
    isInheritanceEnabled?: boolean
}

export interface References {
    postsWordpress?: PostReference[]
    postsGdocs?: PostReference[]
    explorers?: string[]
    narrativeCharts?: NarrativeChartMinimalInformation[]
    childCharts?: IndicatorChartInfo[]
    dataInsights?: DataInsightMinimalInformation[]
}

export abstract class AbstractChartEditor<
    Manager extends AbstractChartEditorManager = AbstractChartEditorManager,
> {
    manager: Manager

    grapherState = new GrapherState({
        additionalDataLoaderFn: (varId: number) =>
            loadVariableDataAndMetadata(varId, DATA_API_URL, { noCache: true }),
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
    // if inheritance is enabled, the parent config is applied to grapherState
    isInheritanceEnabled: boolean | undefined = undefined

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
            isInheritanceEnabled: observable.ref,
        })
        this.manager = props.manager
        this.previewMode =
            localStorage.getItem("editorPreviewMode") === "mobile"
                ? "mobile"
                : "desktop"

        when(
            () => this.manager.parentConfig !== undefined,
            () => (this.parentConfig = this.manager.parentConfig)
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

    abstract get references(): References | undefined

    /** original grapher config used to init the grapherState instance */
    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig, parentConfig, isInheritanceEnabled } = this.manager
        if (!isInheritanceEnabled) return patchConfig
        return mergeGrapherConfigs(parentConfig ?? {}, patchConfig)
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

    /** parent config currently applied to grapher */
    @computed get activeParentConfig(): GrapherInterface | undefined {
        return this.isInheritanceEnabled ? this.parentConfig : undefined
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
        return !_.isEqual(
            _.omit(this.patchConfig, "version"),
            _.omit(this.savedPatchConfig, "version")
        )
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
        if (!this.isInheritanceEnabled || !this.activeParentConfigWithDefaults)
            return false
        return (
            !Object.hasOwn(this.patchConfig, property) &&
            Object.hasOwn(this.activeParentConfigWithDefaults, property)
        )
    }

    // only works for top-level properties
    canPropertyBeInherited(property: keyof GrapherInterface): boolean {
        if (!this.isInheritanceEnabled || !this.activeParentConfig) return false
        return Object.hasOwn(this.activeParentConfig, property)
    }

    @computed get invalidFocusedSeriesNames(): SeriesName[] {
        const { grapherState } = this

        // if focusing is not supported, then all focused series are invalid
        if (!this.features.canHighlightSeries) {
            return grapherState.focusArray.seriesNames
        }

        // find invalid focused series
        const availableSeriesNames = grapherState.chartSeriesNames
        const focusedSeriesNames = grapherState.focusArray.seriesNames
        return _.difference(focusedSeriesNames, availableSeriesNames)
    }

    @computed get invalidSelectedEntityNames(): SeriesName[] {
        const { grapherState } = this

        // find invalid selected entities
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

    abstract get isNewGrapher(): boolean
    abstract get availableTabs(): EditorTab[]

    abstract saveGrapher(props?: { onError?: () => void }): Promise<void>
}
