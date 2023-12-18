import React from "react"
import ReactDOMServer from "react-dom/server.js"
import {
    observable,
    computed,
    action,
    autorun,
    runInAction,
    reaction,
} from "mobx"
import { bind } from "decko"
import {
    uniqWith,
    isEqual,
    uniq,
    slugify,
    identity,
    lowerCaseFirstLetterUnlessAbbreviation,
    isMobile,
    next,
    sampleFrom,
    range,
    difference,
    exposeInstanceOnWindow,
    findClosestTime,
    excludeUndefined,
    debounce,
    isInIFrame,
    differenceObj,
    QueryParams,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    Bounds,
    DEFAULT_BOUNDS,
    detailOnDemandRegex,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    TimeBounds,
    getTimeDomainFromQueryString,
    TimeBound,
    minTimeToJSON,
    maxTimeToJSON,
    timeBoundToTimeBoundString,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    updatePersistables,
    strToQueryParams,
    queryParamsToStr,
    setWindowQueryStr,
    getWindowUrl,
    Url,
    Annotation,
    ColumnSlug,
    DimensionProperty,
    SortBy,
    SortConfig,
    SortOrder,
    TopicId,
    OwidChartDimensionInterface,
    firstOfNonEmptyArray,
    spansToUnformattedPlainText,
    EnrichedDetail,
    isEmpty,
    compact,
    getOriginAttributionFragments,
    sortBy,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import {
    ChartTypeName,
    GrapherTabOption,
    ScaleType,
    StackMode,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    BASE_FONT_SIZE,
    CookieKey,
    FacetStrategy,
    ThereWasAProblemLoadingThisChart,
    SeriesColorMap,
    FacetAxisDomain,
    AnnotationFieldsInTitle,
    MissingDataStrategy,
    DEFAULT_GRAPHER_CONFIG_SCHEMA,
    DEFAULT_GRAPHER_WIDTH,
    DEFAULT_GRAPHER_HEIGHT,
    SeriesStrategy,
    getVariableDataRoute,
    getVariableMetadataRoute,
    DEFAULT_GRAPHER_FRAME_PADDING,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    GRAPHER_DARK_TEXT,
} from "../core/GrapherConstants"
import Cookies from "js-cookie"
import {
    ChartDimension,
    LegacyDimensionsManager,
} from "../chart/ChartDimension"
import { TooltipManager } from "../tooltip/TooltipProps"
import {
    GrapherInterface,
    grapherKeysToSerialize,
    GrapherQueryParams,
    LegacyGrapherInterface,
} from "../core/GrapherInterface"
import { DimensionSlot } from "../chart/DimensionSlot"
import {
    getSelectedEntityNamesParam,
    setSelectedEntityNamesParam,
} from "./EntityUrlBuilder"
import { MapProjectionName } from "../mapCharts/MapProjections"
import { LogoOption } from "../captionedChart/Logos"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { MapConfig } from "../mapCharts/MapConfig"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine"
import {
    ColumnSlugs,
    Time,
    EntityName,
    OwidColumnDef,
    OwidVariableRow,
    BlankOwidTable,
    OwidTable,
    ColumnTypeMap,
    CoreColumn,
} from "@ourworldindata/core-table"
import { FullScreen } from "../fullScreen/FullScreen"
import { isOnTheMap } from "../mapCharts/EntitiesOnTheMap"
import { ChartManager } from "../chart/ChartManager"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons"
import { SettingsMenuManager } from "../controls/SettingsMenu"
import { TooltipContainer } from "../tooltip/Tooltip"
import {
    EntitySelectorModal,
    EntitySelectorModalManager,
} from "../modal/EntitySelectorModal"
import { DownloadModal, DownloadModalManager } from "../modal/DownloadModal"
import ReactDOM from "react-dom"
import { observer } from "mobx-react"
import "d3-transition"
import { SourcesModal, SourcesModalManager } from "../modal/SourcesModal"
import { DataTableManager } from "../dataTable/DataTable"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { MapChart } from "../mapCharts/MapChart"
import { DiscreteBarChartManager } from "../barCharts/DiscreteBarChartConstants"
import { Command, CommandPalette } from "../controls/CommandPalette"
import { ShareMenuManager } from "../controls/ShareMenu"
import { EmbedModalManager, EmbedModal } from "../modal/EmbedModal"
import {
    CaptionedChart,
    CaptionedChartManager,
    StaticCaptionedChart,
} from "../captionedChart/CaptionedChart"
import {
    TimelineController,
    TimelineManager,
} from "../timeline/TimelineController"
import Mousetrap from "mousetrap"
import { SlideShowController } from "../slideshowController/SlideShowController"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import { ColorSchemeName } from "../color/ColorConstants"
import { Entity, SelectionArray } from "../selection/SelectionArray"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable"
import { ScatterPlotManager } from "../scatterCharts/ScatterPlotChartConstants"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
} from "../chart/ChartUtils"
import classnames from "classnames"
import { GrapherAnalytics } from "./GrapherAnalytics"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations"
import { ChartInterface, ChartTableTransformer } from "../chart/ChartInterface"
import { MarimekkoChartManager } from "../stackedCharts/MarimekkoChartConstants"
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import Bugsnag from "@bugsnag/js"
import { FacetChartManager } from "../facetChart/FacetChartConstants"

declare const window: any

async function loadVariablesDataAdmin(
    variableFetchBaseUrl: string | undefined,
    variableIds: number[]
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const dataFetchPath = (variableId: number): string =>
        variableFetchBaseUrl
            ? `${variableFetchBaseUrl}/v1/variableById/data/${variableId}`
            : `/api/data/variables/data/${variableId}.json`
    const metadataFetchPath = (variableId: number): string =>
        variableFetchBaseUrl
            ? `${variableFetchBaseUrl}/v1/variableById/metadata/${variableId}`
            : `/api/data/variables/metadata/${variableId}.json`

    const loadVariableDataPromises = variableIds.map(async (variableId) => {
        const dataPromise = window.admin.getJSON(
            dataFetchPath(variableId)
        ) as Promise<OwidVariableMixedData>
        const metadataPromise = window.admin.getJSON(
            metadataFetchPath(variableId)
        ) as Promise<OwidVariableWithSourceAndDimension>
        const [data, metadata] = await Promise.all([
            dataPromise,
            metadataPromise,
        ])
        return { data, metadata: { ...metadata, id: variableId } }
    })
    const variablesData: OwidVariableDataMetadataDimensions[] =
        await Promise.all(loadVariableDataPromises)
    const variablesDataMap = new Map(
        variablesData.map((data) => [data.metadata.id, data])
    )
    return variablesDataMap
}

async function loadVariablesDataSite(
    variableIds: number[],
    dataApiUrl: string
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const loadVariableDataPromises = variableIds.map(async (variableId) => {
        const dataPromise = fetch(getVariableDataRoute(dataApiUrl, variableId))
        const metadataPromise = fetch(
            getVariableMetadataRoute(dataApiUrl, variableId)
        )
        const [dataResponse, metadataResponse] = await Promise.all([
            dataPromise,
            metadataPromise,
        ])
        if (!dataResponse.ok) throw new Error(dataResponse.statusText)
        if (!metadataResponse.ok) throw new Error(metadataResponse.statusText)
        const data = await dataResponse.json()
        const metadata = await metadataResponse.json()
        return { data, metadata }
    })
    const variablesData: OwidVariableDataMetadataDimensions[] =
        await Promise.all(loadVariableDataPromises)
    const variablesDataMap = new Map(
        variablesData.map((data) => [data.metadata.id, data])
    )
    return variablesDataMap
}

const DEFAULT_MS_PER_TICK = 100

// Exactly the same as GrapherInterface, but contains options that developers want but authors won't be touching.
export interface GrapherProgrammaticInterface extends GrapherInterface {
    owidDataset?: MultipleOwidVariableDataDimensionsMap // This is temporarily used for testing. Will be removed
    manuallyProvideData?: boolean // This will be removed.
    queryStr?: string
    bounds?: Bounds
    table?: OwidTable
    bakedGrapherURL?: string
    adminBaseUrl?: string
    dataApiUrl?: string
    env?: string
    dataApiUrlForAdmin?: string
    annotation?: Annotation

    hideEntityControls?: boolean
    hideZoomToggle?: boolean
    hideNoDataAreaToggle?: boolean
    hideFacetYDomainToggle?: boolean
    hideXScaleToggle?: boolean
    hideYScaleToggle?: boolean
    hideMapProjectionMenu?: boolean
    hideTableFilterToggle?: boolean
    forceHideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    hasTableTab?: boolean
    hideShareButton?: boolean
    hideExploreTheDataButton?: boolean
    hideRelatedQuestion?: boolean

    getGrapherInstance?: (instance: Grapher) => void

    enableKeyboardShortcuts?: boolean
    bindUrlToWindow?: boolean
    isEmbeddedInAnOwidPage?: boolean
    isEmbeddedInADataPage?: boolean
    shouldOptimizeForHorizontalSpace?: boolean

    manager?: GrapherManager
    instanceRef?: React.RefObject<Grapher>
}

export interface GrapherManager {
    canonicalUrl?: string
    embedDialogUrl?: string
    embedDialogAdditionalElements?: React.ReactElement
    selection?: SelectionArray
    editUrl?: string
}

@observer
export class Grapher
    extends React.Component<GrapherProgrammaticInterface>
    implements
        TimelineManager,
        ChartManager,
        FontSizeManager,
        CaptionedChartManager,
        SourcesModalManager,
        DownloadModalManager,
        DiscreteBarChartManager,
        LegacyDimensionsManager,
        ShareMenuManager,
        EmbedModalManager,
        TooltipManager,
        DataTableManager,
        ScatterPlotManager,
        MarimekkoChartManager,
        FacetChartManager,
        EntitySelectorModalManager,
        SettingsMenuManager,
        MapChartManager
{
    @observable.ref $schema = DEFAULT_GRAPHER_CONFIG_SCHEMA
    @observable.ref type = ChartTypeName.LineChart
    @observable.ref id?: number = undefined
    @observable.ref version = 1
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle: string | undefined = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note = ""
    @observable hideAnnotationFieldsInTitle?: AnnotationFieldsInTitle =
        undefined
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined
    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined
    @observable.ref addCountryMode = EntitySelectionMode.MultipleEntities
    @observable.ref stackMode = StackMode.absolute
    @observable.ref showNoDataArea = true
    @observable.ref hideLegend?: boolean = false
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle? = true
    @observable.ref entityType = DEFAULT_GRAPHER_ENTITY_TYPE
    @observable.ref entityTypePlural = DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL
    @observable.ref facettingLabelByYVariables = "metric"
    @observable.ref hideTimeline?: boolean = undefined
    @observable.ref hideScatterLabels?: boolean = undefined
    @observable.ref zoomToSelection?: boolean = undefined
    @observable.ref showYearLabels?: boolean = undefined // Always show year in labels for bar charts
    @observable.ref hasChartTab = true
    @observable.ref hasMapTab = false
    @observable.ref tab = GrapherTabOption.chart
    @observable.ref internalNotes = ""
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl = ""
    @observable.ref topicIds: TopicId[] = []
    @observable.ref isPublished?: boolean = undefined
    @observable.ref baseColorScheme?: ColorSchemeName = undefined
    @observable.ref invertColorScheme?: boolean = undefined
    @observable.ref hideLinesOutsideTolerance?: boolean = undefined
    @observable hideConnectedScatterLines?: boolean = undefined // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: boolean = undefined
    @observable.ref matchingEntitiesOnly?: boolean = undefined
    /** Hides the total value label that is normally displayed for stacked bar charts */
    @observable.ref hideTotalValueLabel?: boolean = undefined
    @observable.ref missingDataStrategy?: MissingDataStrategy = undefined
    @observable.ref showSelectionOnlyInDataTable?: boolean = undefined

    @observable.ref xAxis = new AxisConfig(undefined, this)
    @observable.ref yAxis = new AxisConfig(undefined, this)
    @observable colorScale = new ColorScaleConfig()
    @observable map = new MapConfig()
    @observable.ref dimensions: ChartDimension[] = []

    @observable ySlugs?: ColumnSlugs = undefined
    @observable xSlug?: ColumnSlug = undefined
    @observable colorSlug?: ColumnSlug = undefined
    @observable sizeSlug?: ColumnSlug = undefined
    @observable tableSlugs?: ColumnSlugs = undefined
    @observable backgroundSeriesLimit?: number = undefined

    @observable selectedEntityNames: EntityName[] = []
    @observable selectedEntityColors: {
        [entityName: string]: string | undefined
    } = {}
    @observable excludedEntities?: number[] = undefined
    /** IncludedEntities are ususally empty which means use all available entites. When
        includedEntities is set it means "only use these entities". excludedEntities
        are evaluated afterwards and can still remove entities even if they were included before.
     */
    @observable includedEntities?: number[] = undefined
    @observable comparisonLines: ComparisonLineConfig[] = [] // todo: Persistables?
    @observable relatedQuestions: RelatedQuestionsConfig[] = [] // todo: Persistables?

    @observable.ref annotation?: Annotation = undefined

    @observable.ref hideFacetControl?: boolean = undefined

    // the desired faceting strategy, which might not be possible if we change the data
    @observable selectedFacetStrategy?: FacetStrategy = undefined

    @observable sortBy?: SortBy
    @observable sortOrder?: SortOrder
    @observable sortColumnSlug?: string

    @observable.ref _isInFullScreenMode = false

    @observable.ref windowInnerWidth?: number
    @observable.ref windowInnerHeight?: number

    owidDataset?: MultipleOwidVariableDataDimensionsMap = undefined // This is used for passing data for testing

    manuallyProvideData? = false // This will be removed.

    // TODO: Pass these 5 in as options, don't get them as globals.
    isDev = this.props.env === "development"
    analytics = new GrapherAnalytics(this.props.env ?? "")
    isEditor =
        typeof window !== "undefined" && (window as any).isEditor === true
    @observable bakedGrapherURL = this.props.bakedGrapherURL
    adminBaseUrl = this.props.adminBaseUrl
    dataApiUrl =
        this.props.dataApiUrl ?? "https://api.ourworldindata.org/v1/indicators/"

    @observable.ref inputTable: OwidTable

    @observable.ref legacyConfigAsAuthored: Partial<LegacyGrapherInterface> = {}

    @computed get dataApiUrlForAdmin(): string | undefined {
        return this.props.dataApiUrlForAdmin
    }

    @computed get dataTableSlugs(): ColumnSlug[] {
        return this.tableSlugs ? this.tableSlugs.split(" ") : this.newSlugs
    }

    isEmbeddedInAnOwidPage?: boolean = this.props.isEmbeddedInAnOwidPage
    isEmbeddedInADataPage?: boolean = this.props.isEmbeddedInADataPage

    // if true, grapher bleeds onto the edges horizontally and the left and right borders
    // are removed while the top and bottom borders stretch across the entire page
    @observable shouldOptimizeForHorizontalSpace = false

    @computed private get optimizeForHorizontalSpace(): boolean {
        return (
            this.isNarrow &&
            this.shouldOptimizeForHorizontalSpace &&
            // in full-screen mode, we prefer padding on the sides
            !this.isInFullScreenMode
        )
    }

    /**
     * todo: factor this out and make more RAII.
     *
     * Explorers create 1 Grapher instance, but as the user clicks around the Explorer loads other author created Graphers.
     * But currently some Grapher features depend on knowing how the current state is different than the "authored state".
     * So when an Explorer updates the grapher, it also needs to update this "original state".
     */
    @action.bound setAuthoredVersion(
        config: Partial<LegacyGrapherInterface>
    ): void {
        this.legacyConfigAsAuthored = config
    }

    @action.bound updateAuthoredVersion(
        config: Partial<LegacyGrapherInterface>
    ): void {
        this.legacyConfigAsAuthored = {
            ...this.legacyConfigAsAuthored,
            ...config,
        }
    }

    constructor(
        propsWithGrapherInstanceGetter: GrapherProgrammaticInterface = {}
    ) {
        super(propsWithGrapherInstanceGetter)

        const { getGrapherInstance, ...props } = propsWithGrapherInstanceGetter

        this.inputTable = props.table ?? BlankOwidTable(`initialGrapherTable`)

        if (props) this.setAuthoredVersion(props)

        this.updateFromObject(props)

        if (!props.table) this.downloadData()

        this.populateFromQueryParams(
            legacyToCurrentGrapherQueryParams(props.queryStr ?? "")
        )

        if (this.isEditor) {
            this.ensureValidConfigWhenEditing()
        }

        if (getGrapherInstance) getGrapherInstance(this) // todo: possibly replace with more idiomatic ref
    }

    toObject(): GrapherInterface {
        const obj: GrapherInterface = objectWithPersistablesToObject(
            this,
            grapherKeysToSerialize
        )

        obj.selectedEntityNames = this.selection.selectedEntityNames

        deleteRuntimeAndUnchangedProps(obj, defaultObject)

        // always include the schema, even if it's the default
        obj.$schema = this.$schema || DEFAULT_GRAPHER_CONFIG_SCHEMA

        // todo: nulls got into the DB for this one. we can remove after moving Graphers from DB.
        if (obj.stackMode === null) delete obj.stackMode

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        // todo: remove dimensions concept
        // if (this.legacyConfigAsAuthored?.dimensions)
        //     obj.dimensions = this.legacyConfigAsAuthored.dimensions

        return obj
    }

    @action.bound downloadData(): void {
        if (this.manuallyProvideData) {
        } else if (this.owidDataset) {
            this._receiveOwidDataAndApplySelection(this.owidDataset)
        } else this.downloadLegacyDataFromOwidVariableIds()
    }

    @action.bound updateFromObject(obj?: GrapherProgrammaticInterface): void {
        if (!obj) return

        // we can remove when we purge current graphers which have this set.
        if (obj.stackMode === null) delete obj.stackMode

        updatePersistables(this, obj)

        // Regression fix: some legacies have this set to Null. Todo: clean DB.
        if (obj.originUrl === null) this.originUrl = ""

        // JSON doesn't support Infinity, so we use strings instead.
        this.minTime = minTimeBoundFromJSONOrNegativeInfinity(obj.minTime)
        this.maxTime = maxTimeBoundFromJSONOrPositiveInfinity(obj.maxTime)

        // Todo: remove once we are more RAII.
        if (obj?.dimensions?.length)
            this.setDimensionsFromConfigs(obj.dimensions)
    }

    @action.bound populateFromQueryParams(params: GrapherQueryParams): void {
        // Set tab if specified
        const tab = params.tab
        if (tab) {
            if (this.availableTabs.includes(tab as any)) {
                this.tab = tab as GrapherTabOption
            } else {
                console.error("Unexpected tab: " + tab)
            }
        }

        // Set overlay if specified
        const overlay = params.overlay
        if (overlay) {
            if (overlay === "sources") {
                this.isSourcesModalOpen = true
            } else if (overlay === "download") {
                this.isDownloadModalOpen = true
            } else {
                console.error("Unexpected overlay: " + overlay)
            }
        }

        // Stack mode for bar and stacked area charts
        this.stackMode = (params.stackMode ?? this.stackMode) as StackMode

        this.zoomToSelection =
            params.zoomToSelection === "true" ? true : this.zoomToSelection

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType === ScaleType.linear || xScaleType === ScaleType.log)
                this.xAxis.scaleType = xScaleType
            else console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType === ScaleType.linear || yScaleType === ScaleType.log)
                this.yAxis.scaleType = yScaleType
            else console.error("Unexpected xScale: " + yScaleType)
        }

        const time = params.time
        if (time !== undefined && time !== "")
            this.setTimeFromTimeQueryParam(time)

        const endpointsOnly = params.endpointsOnly
        if (endpointsOnly !== undefined)
            this.compareEndPointsOnly = endpointsOnly === "1" ? true : undefined

        const region = params.region
        if (region !== undefined)
            this.map.projection = region as MapProjectionName

        const selection = getSelectedEntityNamesParam(
            Url.fromQueryParams(params)
        )

        if (this.addCountryMode !== EntitySelectionMode.Disabled && selection)
            this.selection.setSelectedEntities(selection)

        // faceting
        if (params.facet && params.facet in FacetStrategy) {
            this.selectedFacetStrategy = params.facet as FacetStrategy
        }
        if (params.uniformYAxis === "0") {
            this.yAxis.facetDomain = FacetAxisDomain.independent
        } else if (params.uniformYAxis === "1") {
            this.yAxis.facetDomain = FacetAxisDomain.shared
        }
    }

    @action.bound private setTimeFromTimeQueryParam(time: string): void {
        this.timelineHandleTimeBounds = getTimeDomainFromQueryString(time).map(
            (time) => findClosestTime(this.times, time) ?? time
        ) as TimeBounds
    }

    @computed get isOnChartTab(): boolean {
        return this.tab === GrapherTabOption.chart
    }

    @computed get isOnMapTab(): boolean {
        return this.tab === GrapherTabOption.map
    }

    @computed get isOnTableTab(): boolean {
        return this.tab === GrapherTabOption.table
    }

    @computed get isOnChartOrMapTab(): boolean {
        return this.isOnChartTab || this.isOnMapTab
    }

    @computed get yAxisConfig(): Readonly<AxisConfigInterface> {
        return this.yAxis.toObject()
    }

    @computed get xAxisConfig(): Readonly<AxisConfigInterface> {
        return this.xAxis.toObject()
    }

    // table that is used for display in the table tab
    @computed get tableForDisplay(): OwidTable {
        const table = this.table
        if (!this.isReady || !this.isOnTableTab) return table
        return this.chartInstance.transformTableForDisplay
            ? this.chartInstance.transformTableForDisplay(table)
            : table
    }

    @computed get tableForSelection(): OwidTable {
        // This table specifies which entities can be selected in the charts EntitySelectorModal.
        // It should contain all entities that can be selected, and none more.
        // Depending on the chart type, the criteria for being able to select an entity are
        // different; e.g. for scatterplots, the entity needs to (1) not be excluded and
        // (2) needs to have data for the x and y dimension.
        let table =
            this.isScatter || this.isSlopeChart
                ? this.tableAfterAuthorTimelineAndActiveChartTransform
                : this.inputTable

        if (!this.isReady) return table

        // Some chart types (e.g. stacked area charts) choose not to show an entity
        // with incomplete data. Such chart types define a custom transform function
        // to ensure that the entity selector only offers entities that are actually plotted.
        if (this.chartInstance.transformTableForSelection) {
            table = this.chartInstance.transformTableForSelection(table)
        }

        return table
    }

    // If an author sets a timeline filter run it early in the pipeline so to the charts it's as if the filtered times do not exist
    @computed get tableAfterAuthorTimelineFilter(): OwidTable {
        const table = this.inputTable
        if (
            this.timelineMinTime === undefined &&
            this.timelineMaxTime === undefined
        )
            return table
        return table.filterByTimeRange(
            this.timelineMinTime ?? -Infinity,
            this.timelineMaxTime ?? Infinity
        )
    }

    // Convenience method for debugging
    windowQueryParams(str = location.search): QueryParams {
        return strToQueryParams(str)
    }

    @computed
    get tableAfterAuthorTimelineAndActiveChartTransform(): OwidTable {
        const table = this.tableAfterAuthorTimelineFilter
        if (!this.isReady || !this.isOnChartOrMapTab) return table
        return this.chartInstance.transformTable(table)
    }

    @computed get chartInstance(): ChartInterface {
        // Note: when timeline handles on a LineChart are collapsed into a single handle, the
        // LineChart turns into a DiscreteBar.

        return this.isOnMapTab
            ? new MapChart({ manager: this })
            : this.chartInstanceExceptMap
    }

    // When Map becomes a first-class chart instance, we should drop this
    @computed get chartInstanceExceptMap(): ChartInterface {
        const chartTypeName =
            this.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart

        const ChartClass =
            ChartComponentClassMap.get(chartTypeName) ?? DefaultChartClass
        return new ChartClass({ manager: this })
    }

    @computed get table(): OwidTable {
        return this.tableAfterAuthorTimelineFilter
    }

    @computed
    private get tableAfterAllTransformsAndFilters(): OwidTable {
        const { startTime, endTime } = this
        const table = this.tableAfterAuthorTimelineAndActiveChartTransform

        if (startTime === undefined || endTime === undefined) return table

        if (this.isOnMapTab)
            return table.filterByTargetTimes(
                [endTime],
                this.map.timeTolerance ??
                    table.get(this.mapColumnSlug).tolerance
            )

        if (
            this.isDiscreteBar ||
            this.isLineChartThatTurnedIntoDiscreteBar ||
            this.isMarimekko
        )
            return table.filterByTargetTimes(
                [endTime],
                table.get(this.yColumnSlugs[0]).tolerance
            )

        if (this.isSlopeChart)
            return table.filterByTargetTimes([startTime, endTime])

        return table.filterByTimeRange(startTime, endTime)
    }

    @computed get transformedTable(): OwidTable {
        return this.tableAfterAllTransformsAndFilters
    }

    @observable.ref isExportingtoSvgOrPng = false
    @observable.ref isGeneratingThumbnail = false

    tooltips?: TooltipManager["tooltips"] = observable.map({}, { deep: false })
    @observable isPlaying = false
    @observable.ref isSelectingData = false

    @observable.ref isSourcesModalOpen = false
    @observable.ref isDownloadModalOpen = false
    @observable.ref isEmbedModalOpen = false

    private get isStaging(): boolean {
        if (typeof location === undefined) return false
        return location.host.includes("staging")
    }

    @computed get editUrl(): string | undefined {
        if (!this.showAdminControls && !this.isDev && !this.isStaging)
            return undefined
        return `${this.adminBaseUrl}/admin/${
            this.manager?.editUrl ?? `charts/${this.id}/edit`
        }`
    }

    /**
     * Whether the chart is rendered in an Admin context (e.g. on owid.cloud).
     */
    @computed get useAdminAPI(): boolean {
        if (typeof window === "undefined") return false
        return window.admin !== undefined
    }

    /**
     * Whether the user viewing the chart is an admin and we should show admin controls,
     * like the "Edit" option in the share menu.
     */
    @computed get showAdminControls(): boolean {
        // This cookie is set by visiting ourworldindata.org/identifyadmin on the static site.
        // There is an iframe on owid.cloud to trigger a visit to that page.

        try {
            // Cookie access can be restricted by iframe sandboxing, in which case the below code will throw an error
            // see https://github.com/owid/owid-grapher/pull/2452

            return !!Cookies.get(CookieKey.isAdmin)
        } catch {
            return false
        }
    }

    @action.bound
    async downloadLegacyDataFromOwidVariableIds(
        inputTableTransformer?: ChartTableTransformer
    ): Promise<void> {
        if (this.variableIds.length === 0)
            // No data to download
            return

        try {
            let variablesDataMap: MultipleOwidVariableDataDimensionsMap
            if (this.useAdminAPI) {
                // TODO grapher model: switch this to downloading multiple data and metadata files
                variablesDataMap = await loadVariablesDataAdmin(
                    this.dataApiUrlForAdmin,
                    this.variableIds
                )
            } else {
                variablesDataMap = await loadVariablesDataSite(
                    this.variableIds,
                    this.dataApiUrl
                )
            }

            this._receiveOwidDataAndApplySelection(
                variablesDataMap,
                inputTableTransformer
            )
        } catch (err) {
            // eslint-disable-next-line no-console
            console.log(`Error fetching '${err}'`)
            console.error(err)
            Bugsnag?.notify(`Error fetching variables: ${err}`, (event) => {
                event.addMetadata("context", {
                    variableIds: this.variableIds,
                })
            })
        }
    }

    @action.bound receiveOwidData(
        json: MultipleOwidVariableDataDimensionsMap
    ): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files
        this._receiveOwidDataAndApplySelection(json)
    }

    @action.bound private _setInputTable(
        json: MultipleOwidVariableDataDimensionsMap,
        legacyConfig: Partial<LegacyGrapherInterface>,
        inputTableTransformer?: ChartTableTransformer
    ): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files
        const { dimensions, table } = legacyToOwidTableAndDimensions(
            json,
            legacyConfig
        )

        if (inputTableTransformer)
            this.inputTable = inputTableTransformer(table)
        else this.inputTable = table

        // We need to reset the dimensions because some of them may have changed slugs in the legacy
        // transformation (can happen when columns use targetTime)
        this.setDimensionsFromConfigs(dimensions)

        this.appendNewEntitySelectionOptions()

        if (this.manager?.selection?.hasSelection) {
            // Selection is managed externally, do nothing.
        } else if (this.selection.hasSelection) {
            // User has changed the selection, use theris
        } else this.applyOriginalSelectionAsAuthored()
    }

    @action rebuildInputOwidTable(
        inputTableTransformer?: ChartTableTransformer
    ): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files
        if (!this.legacyVariableDataJson) return
        this._setInputTable(
            this.legacyVariableDataJson,
            this.legacyConfigAsAuthored,
            inputTableTransformer
        )
    }

    @observable
    private legacyVariableDataJson?: MultipleOwidVariableDataDimensionsMap

    @action.bound private _receiveOwidDataAndApplySelection(
        json: MultipleOwidVariableDataDimensionsMap,
        inputTableTransformer?: ChartTableTransformer
    ): void {
        this.legacyVariableDataJson = json

        this.rebuildInputOwidTable(inputTableTransformer)
    }

    @action.bound appendNewEntitySelectionOptions(): void {
        const { selection } = this
        const currentEntities = selection.availableEntityNameSet
        const missingEntities = this.availableEntities.filter(
            (entity) => !currentEntities.has(entity.entityName)
        )
        selection.addAvailableEntityNames(missingEntities)
    }

    @action.bound private applyOriginalSelectionAsAuthored(): void {
        if (this.selectedEntityNames.length)
            this.selection.setSelectedEntities(this.selectedEntityNames)
    }

    @observable private _baseFontSize = BASE_FONT_SIZE

    @computed get baseFontSize(): number {
        if (this.isExportingtoSvgOrPng) return Math.max(this._baseFontSize, 18)
        return this._baseFontSize
    }

    set baseFontSize(val: number) {
        this._baseFontSize = val
    }

    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady(): boolean {
        return this.whatAreWeWaitingFor === ""
    }

    @computed get whatAreWeWaitingFor(): string {
        const { newSlugs, inputTable, dimensions } = this
        if (newSlugs.length || dimensions.length === 0) {
            const missingColumns = newSlugs.filter(
                (slug) => !inputTable.has(slug)
            )
            return missingColumns.length
                ? `Waiting for columns ${missingColumns.join(",")} in table '${
                      inputTable.tableSlug
                  }'. ${inputTable.tableDescription}`
                : ""
        }
        if (dimensions.length > 0 && this.loadingDimensions.length === 0)
            return ""
        return `Waiting for dimensions ${this.loadingDimensions.join(",")}.`
    }

    // If we are using new slugs and not dimensions, Grapher is ready.
    @computed get newSlugs(): string[] {
        const { xSlug, colorSlug, sizeSlug } = this
        const ySlugs = this.ySlugs ? this.ySlugs.split(" ") : []
        return excludeUndefined([...ySlugs, xSlug, colorSlug, sizeSlug])
    }

    @computed private get loadingDimensions(): ChartDimension[] {
        return this.dimensions.filter(
            (dim) => !this.inputTable.has(dim.columnSlug)
        )
    }

    @computed get isInIFrame(): boolean {
        return isInIFrame()
    }

    @computed get times(): Time[] {
        const columnSlugs = this.isOnMapTab
            ? [this.mapColumnSlug]
            : this.yColumnSlugs

        // Generate the times only after the chart transform has been applied, so that we don't show
        // times on the timeline for which data may not exist, e.g. when the selected entity
        // doesn't contain data for all years in the table.
        // -@danielgavrilov, 2020-10-22
        return this.tableAfterAuthorTimelineAndActiveChartTransform.getTimesUniqSortedAscForColumns(
            columnSlugs
        )
    }

    @computed get startHandleTimeBound(): TimeBound {
        if (this.onlySingleTimeSelectionPossible) return this.endHandleTimeBound
        return this.timelineHandleTimeBounds[0]
    }

    set startHandleTimeBound(newValue: TimeBound) {
        if (this.onlySingleTimeSelectionPossible)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                newValue,
                this.timelineHandleTimeBounds[1],
            ]
    }

    set endHandleTimeBound(newValue: TimeBound) {
        if (this.onlySingleTimeSelectionPossible)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                this.timelineHandleTimeBounds[0],
                newValue,
            ]
    }

    @computed get endHandleTimeBound(): TimeBound {
        return this.timelineHandleTimeBounds[1]
    }

    @action.bound resetHandleTimeBounds(): void {
        this.startHandleTimeBound = this.timelineMinTime ?? -Infinity
        this.endHandleTimeBound = this.timelineMaxTime ?? Infinity
    }

    // Keeps a running cache of series colors at the Grapher level.
    seriesColorMap: SeriesColorMap = new Map()

    @computed get startTime(): Time | undefined {
        return findClosestTime(this.times, this.startHandleTimeBound)
    }

    @computed get endTime(): Time | undefined {
        return findClosestTime(this.times, this.endHandleTimeBound)
    }

    @computed private get onlySingleTimeSelectionPossible(): boolean {
        return (
            this.isDiscreteBar ||
            this.isStackedDiscreteBar ||
            this.isOnMapTab ||
            this.isMarimekko
        )
    }

    @computed get shouldLinkToOwid(): boolean {
        if (
            this.isEmbeddedInAnOwidPage ||
            this.isExportingtoSvgOrPng ||
            !this.isInIFrame
        )
            return false

        return true
    }

    @computed.struct private get variableIds(): number[] {
        return uniq(this.dimensions.map((d) => d.variableId))
    }

    externalCsvLink = ""

    @computed get hasOWIDLogo(): boolean {
        return (
            !this.hideLogo && (this.logo === undefined || this.logo === "owid")
        )
    }

    // todo: did this name get botched in a merge?
    @computed get hasFatalErrors(): boolean {
        return this.relatedQuestions.some(
            (question) => !!getErrorMessageRelatedQuestionUrl(question)
        )
    }

    disposers: (() => void)[] = []

    @bind dispose(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    // todo: can we remove this?
    // I believe these states can only occur during editing.
    @action.bound private ensureValidConfigWhenEditing(): void {
        this.disposers.push(
            reaction(
                () => this.variableIds,
                () => this.downloadLegacyDataFromOwidVariableIds()
            )
        )
        const disposers = [
            autorun(() => {
                if (!this.availableTabs.includes(this.tab))
                    runInAction(() => (this.tab = this.availableTabs[0]))
            }),
            autorun(() => {
                const validDimensions = this.validDimensions
                if (!isEqual(this.dimensions, validDimensions))
                    this.dimensions = validDimensions
            }),
        ]
        this.disposers.push(...disposers)
    }

    @computed private get validDimensions(): ChartDimension[] {
        const { dimensions } = this
        const validProperties = this.dimensionSlots.map((d) => d.property)
        let validDimensions = dimensions.filter((dim) =>
            validProperties.includes(dim.property)
        )

        this.dimensionSlots.forEach((slot) => {
            if (!slot.allowMultiple)
                validDimensions = uniqWith(
                    validDimensions,
                    (
                        a: OwidChartDimensionInterface,
                        b: OwidChartDimensionInterface
                    ) =>
                        a.property === slot.property &&
                        a.property === b.property
                )
        })

        return validDimensions
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol(): string {
        let url = this.originUrl
        if (!url.startsWith("http")) url = `https://${url}`
        return url
    }

    @computed get timelineHandleTimeBounds(): TimeBounds {
        if (this.isOnMapTab) {
            const time = maxTimeBoundFromJSONOrPositiveInfinity(this.map.time)
            return [time, time]
        }
        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeBoundFromJSONOrNegativeInfinity(this.minTime),
            maxTimeBoundFromJSONOrPositiveInfinity(this.maxTime),
        ]
    }

    set timelineHandleTimeBounds(value: TimeBounds) {
        if (this.isOnMapTab) {
            this.map.time = value[1]
        } else {
            this.minTime = value[0]
            this.maxTime = value[1]
        }
    }

    // Get the dimension slots appropriate for this type of chart
    @computed get dimensionSlots(): DimensionSlot[] {
        const xAxis = new DimensionSlot(this, DimensionProperty.x)
        const yAxis = new DimensionSlot(this, DimensionProperty.y)
        const color = new DimensionSlot(this, DimensionProperty.color)
        const size = new DimensionSlot(this, DimensionProperty.size)

        if (this.isLineChart || this.isDiscreteBar) return [yAxis, color]
        else if (this.isScatter) return [yAxis, xAxis, size, color]
        else if (this.isMarimekko) return [yAxis, xAxis, color]
        else if (this.isSlopeChart) return [yAxis, size, color]
        return [yAxis]
    }

    @computed.struct get filledDimensions(): ChartDimension[] {
        return this.isReady ? this.dimensions : []
    }

    @action.bound addDimension(config: OwidChartDimensionInterface): void {
        this.dimensions.push(new ChartDimension(config, this))
    }

    @action.bound setDimensionsForProperty(
        property: DimensionProperty,
        newConfigs: OwidChartDimensionInterface[]
    ): void {
        let newDimensions: ChartDimension[] = []
        this.dimensionSlots.forEach((slot) => {
            if (slot.property === property)
                newDimensions = newDimensions.concat(
                    newConfigs.map((config) => new ChartDimension(config, this))
                )
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.dimensions = newDimensions
    }

    @action.bound setDimensionsFromConfigs(
        configs: OwidChartDimensionInterface[]
    ): void {
        this.dimensions = configs.map(
            (config) => new ChartDimension(config, this)
        )
    }

    @computed get displaySlug(): string {
        return this.slug ?? slugify(this.displayTitle)
    }

    @observable shouldIncludeDetailsInStaticExport = true

    // Used for superscript numbers in static exports
    @computed get detailsOrderedByReference(): Set<string> {
        const textInOrderOfAppearance = this.currentSubtitle + this.note
        const details = textInOrderOfAppearance.matchAll(
            new RegExp(detailOnDemandRegex, "g")
        )
        const uniqueDetails = new Set<string>()
        for (const [_, detail] of details) {
            uniqueDetails.add(detail)
        }
        return uniqueDetails
    }

    // Used for static exports. Defined at this level because they need to
    // be accessed by CaptionedChart and DownloadModal
    @computed get detailRenderers(): MarkdownTextWrap[] {
        return [...this.detailsOrderedByReference].map((term, i) => {
            let text = `**${i + 1}.** `
            const detail: EnrichedDetail = window.details?.[term]
            if (detail) {
                const plainText = detail.text.map(({ value }) =>
                    spansToUnformattedPlainText(value)
                )
                plainText[0] = `**${plainText[0]}**:`

                text += `${plainText.join(" ")}`
            }
            return new MarkdownTextWrap({
                text,
                fontSize: 12,
                // leave room for padding on the left and right
                maxWidth:
                    this.idealBounds.width - 2 * this.framePaddingHorizontal,
                lineHeight: 1.2,
                style: {
                    fill: GRAPHER_DARK_TEXT,
                },
            })
        })
    }

    @computed get availableTabs(): GrapherTabOption[] {
        return [
            this.hasTableTab && GrapherTabOption.table,
            this.hasMapTab && GrapherTabOption.map,
            this.hasChartTab && GrapherTabOption.chart,
        ].filter(identity) as GrapherTabOption[]
    }

    @computed get currentSubtitle(): string {
        const subtitle = this.subtitle
        if (subtitle !== undefined) return subtitle
        const yColumns = this.yColumnsFromDimensions
        if (yColumns.length === 1) return yColumns[0].def.descriptionShort ?? ""
        return ""
    }

    @computed get currentTitle(): string {
        let text = this.displayTitle.trim()
        const selectedEntityNames = this.selection.selectedEntityNames
        const showEntityAnnotation = !this.hideAnnotationFieldsInTitle?.entity
        const showTimeAnnotation = !this.hideAnnotationFieldsInTitle?.time
        const showChangeInPrefix =
            !this.hideAnnotationFieldsInTitle?.changeInPrefix

        const seriesStrategy =
            this.chartInstance.seriesStrategy ||
            autoDetectSeriesStrategy(this, true)

        // helper function to add an annotation fragment to the title
        // only adds a comma if the text does not end with a question mark
        const appendAnnotationField = (
            text: string,
            annotation: string
        ): string => {
            const separator = text.endsWith("?") ? "" : ","
            return `${text}${separator} ${annotation}`
        }

        if (
            !this.forceHideAnnotationFieldsInTitle?.entity &&
            this.tab === GrapherTabOption.chart &&
            (seriesStrategy !== SeriesStrategy.entity || this.hideLegend) &&
            selectedEntityNames.length === 1 &&
            (showEntityAnnotation ||
                this.canChangeEntity ||
                this.canSelectMultipleEntities)
        ) {
            const entityStr = selectedEntityNames[0]
            if (entityStr?.length) text = appendAnnotationField(text, entityStr)
        }

        if (
            !this.forceHideAnnotationFieldsInTitle?.changeInPrefix &&
            this.isLineChart &&
            this.isRelativeMode &&
            showChangeInPrefix
        )
            text = "Change in " + lowerCaseFirstLetterUnlessAbbreviation(text)

        if (
            !this.forceHideAnnotationFieldsInTitle?.time &&
            this.isReady &&
            (showTimeAnnotation ||
                (this.hasTimeline &&
                    // chart types that refer to the current time only in the timeline
                    (this.isLineChartThatTurnedIntoDiscreteBar ||
                        this.isDiscreteBar ||
                        this.isStackedDiscreteBar ||
                        this.isMarimekko ||
                        this.isOnMapTab)))
        )
            text = appendAnnotationField(text, this.timeTitleSuffix)

        return text.trim()
    }

    /**
     * Uses some explicit and implicit information to decide whether a timeline is shown.
     */
    @computed get hasTimeline(): boolean {
        // we don't have more than one distinct time point in our data, so it doesn't make sense to show a timeline
        if (this.times.length <= 1) return false

        switch (this.tab) {
            // the map tab has its own `hideTimeline` option
            case GrapherTabOption.map:
                return !this.map.hideTimeline

            // use the chart-level `hideTimeline` option for the table, too
            case GrapherTabOption.table:
            case GrapherTabOption.chart:
                return !this.hideTimeline

            default:
                return false
        }
    }

    @computed private get areHandlesOnSameTime(): boolean {
        const times = this.tableAfterAuthorTimelineFilter.timeColumn.uniqValues
        const [start, end] = this.timelineHandleTimeBounds.map((time) =>
            findClosestTime(times, time)
        )
        return start === end
    }

    @computed get mapColumnSlug(): string {
        const mapColumnSlug = this.map.columnSlug
        // If there's no mapColumnSlug or there is one but it's not in the dimensions array, use the first ycolumn
        if (
            !mapColumnSlug ||
            !this.dimensions.some((dim) => dim.columnSlug === mapColumnSlug)
        )
            return this.yColumnSlug!
        return mapColumnSlug
    }

    getColumnForProperty(property: DimensionProperty): CoreColumn | undefined {
        return this.dimensions.find((dim) => dim.property === property)?.column
    }

    getSlugForProperty(property: DimensionProperty): string | undefined {
        return this.dimensions.find((dim) => dim.property === property)
            ?.columnSlug
    }

    @computed get yColumnsFromDimensions(): CoreColumn[] {
        return this.filledDimensions
            .filter((dim) => dim.property === DimensionProperty.y)
            .map((dim) => dim.column)
    }

    @computed get yColumnSlugs(): string[] {
        return this.ySlugs
            ? this.ySlugs.split(" ")
            : this.dimensions
                  .filter((dim) => dim.property === DimensionProperty.y)
                  .map((dim) => dim.columnSlug)
    }

    @computed get yColumnSlug(): string | undefined {
        return this.ySlugs
            ? this.ySlugs.split(" ")[0]
            : this.getSlugForProperty(DimensionProperty.y)
    }

    @computed get xColumnSlug(): string | undefined {
        return this.xSlug ?? this.getSlugForProperty(DimensionProperty.x)
    }

    @computed get sizeColumnSlug(): string | undefined {
        return this.sizeSlug ?? this.getSlugForProperty(DimensionProperty.size)
    }

    @computed get colorColumnSlug(): string | undefined {
        return (
            this.colorSlug ?? this.getSlugForProperty(DimensionProperty.color)
        )
    }

    @computed get yScaleType(): ScaleType | undefined {
        return this.yAxis.scaleType
    }

    @computed get xScaleType(): ScaleType | undefined {
        return this.xAxis.scaleType
    }

    @computed private get timeTitleSuffix(): string {
        const timeColumn = this.table.timeColumn
        if (timeColumn.isMissing) return "" // Do not show year until data is loaded
        const { startTime, endTime } = this
        if (startTime === undefined || endTime === undefined) return ""

        const time =
            startTime === endTime
                ? timeColumn.formatValue(startTime)
                : timeColumn.formatValue(startTime) +
                  " to " +
                  timeColumn.formatValue(endTime)

        return time
    }

    @computed get sourcesLine(): string {
        return this.sourceDesc ?? this.defaultSourcesLine
    }

    // Columns that are used as a dimension in the currently active view
    @computed get activeColumnSlugs(): string[] {
        const { yColumnSlugs, xColumnSlug, sizeColumnSlug, colorColumnSlug } =
            this

        return excludeUndefined([
            ...yColumnSlugs,
            xColumnSlug,
            sizeColumnSlug,
            colorColumnSlug,
        ])
    }

    @computed get columnsWithSourcesExtensive(): CoreColumn[] {
        const { yColumnSlugs, xColumnSlug, sizeColumnSlug, colorColumnSlug } =
            this

        // sort y-columns by their display name
        const sortedYColumnSlugs = sortBy(
            yColumnSlugs,
            (slug) => this.inputTable.get(slug).nonEmptyDisplayName
        )

        const columnSlugs = excludeUndefined([
            ...sortedYColumnSlugs,
            xColumnSlug,
            sizeColumnSlug,
            colorColumnSlug,
        ])

        return this.inputTable
            .getColumns(uniq(columnSlugs))
            .filter(
                (column) => !!column.source.name || !isEmpty(column.def.origins)
            )
    }

    getColumnSlugsForCondensedSources(): string[] {
        const { xColumnSlug, sizeColumnSlug, colorColumnSlug, isMarimekko } =
            this
        const columnSlugs: string[] = []

        // "Countries Continent"
        const isContinentsVariableId = (id: string): boolean => id === "123"

        // exclude "Countries Continent" if it's used as the color dimension in a scatter plot, slope chart etc.
        if (
            colorColumnSlug !== undefined &&
            !isContinentsVariableId(colorColumnSlug)
        )
            columnSlugs.push(colorColumnSlug)

        const isPopulationVariableId = (id: string): boolean =>
            id === "525709" || // "Population (historical + projections), Gapminder, HYDE & UN"
            id === "525711" || // "Population (historical estimates), Gapminder, HYDE & UN"
            id === "597929" || // "Population (various sources, 2023.1)"
            id === "597930" // "Population (various sources, 2023.1)"

        if (xColumnSlug !== undefined) {
            // exclude population variable if it's used as the x dimension in a marimekko
            if (!isMarimekko || !isPopulationVariableId(xColumnSlug))
                columnSlugs.push(xColumnSlug)
        }

        // exclude population variable if it's used as the size dimension in a scatter plot
        if (
            sizeColumnSlug !== undefined &&
            !isPopulationVariableId(sizeColumnSlug)
        )
            columnSlugs.push(sizeColumnSlug)
        return columnSlugs
    }

    @computed get columnsWithSourcesCondensed(): CoreColumn[] {
        const { yColumnSlugs } = this

        const columnSlugs = [...yColumnSlugs]
        columnSlugs.push(...this.getColumnSlugsForCondensedSources())

        return this.inputTable
            .getColumns(uniq(columnSlugs))
            .filter(
                (column) => !!column.source.name || !isEmpty(column.def.origins)
            )
    }

    @computed private get defaultSourcesLine(): string {
        const attributions = this.columnsWithSourcesCondensed.flatMap(
            (column) => {
                const { presentation = {} } = column.def
                // if the variable metadata specifies an attribution on the
                // variable level then this is preferred over assembling it from
                // the source and origins
                if (
                    presentation.attribution !== undefined &&
                    presentation.attribution !== ""
                )
                    return [presentation.attribution]
                else {
                    const originFragments = getOriginAttributionFragments(
                        column.def.origins
                    )
                    return [column.source.name, ...originFragments]
                }
            }
        )

        const uniqueAttributions = uniq(compact(attributions))

        if (uniqueAttributions.length > 3)
            return `${uniqueAttributions[0]} and other sources`

        return uniqueAttributions.join("; ")
    }

    @computed private get axisDimensions(): ChartDimension[] {
        return this.filledDimensions.filter(
            (dim) =>
                dim.property === DimensionProperty.y ||
                dim.property === DimensionProperty.x
        )
    }

    // todo: remove when we remove dimensions
    @computed private get yColumnsFromDimensionsOrSlugsOrAuto(): CoreColumn[] {
        return this.yColumnsFromDimensions.length
            ? this.yColumnsFromDimensions
            : this.table.getColumns(autoDetectYColumnSlugs(this))
    }

    @computed private get defaultTitle(): string {
        const yColumns = this.yColumnsFromDimensionsOrSlugsOrAuto

        if (this.isScatter)
            return this.axisDimensions
                .map((dimension) => dimension.column.displayName)
                .join(" vs. ")

        const uniqueDatasetNames = uniq(
            excludeUndefined(
                yColumns.map((col) => (col.def as OwidColumnDef).datasetName)
            )
        )

        if (this.hasMultipleYColumns && uniqueDatasetNames.length === 1)
            return uniqueDatasetNames[0]

        if (yColumns.length === 2)
            return yColumns.map((col) => col.displayName).join(" and ")

        return yColumns.map((col) => col.displayName).join(", ")
    }

    @computed get displayTitle(): string {
        return this.title ?? this.defaultTitle
    }

    // Returns an object ready to be serialized to JSON
    @computed get object(): GrapherInterface {
        return this.toObject()
    }

    @computed
    get typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart(): ChartTypeName {
        // Switch to bar chart if a single year is selected. Todo: do we want to do this?
        return this.isLineChartThatTurnedIntoDiscreteBar
            ? ChartTypeName.DiscreteBar
            : this.type
    }

    @computed get isLineChart(): boolean {
        return this.type === ChartTypeName.LineChart
    }
    @computed get isScatter(): boolean {
        return this.type === ChartTypeName.ScatterPlot
    }
    @computed get isStackedArea(): boolean {
        return this.type === ChartTypeName.StackedArea
    }
    @computed get isSlopeChart(): boolean {
        return this.type === ChartTypeName.SlopeChart
    }
    @computed get isDiscreteBar(): boolean {
        return this.type === ChartTypeName.DiscreteBar
    }
    @computed get isStackedBar(): boolean {
        return this.type === ChartTypeName.StackedBar
    }
    @computed get isMarimekko(): boolean {
        return this.type === ChartTypeName.Marimekko
    }
    @computed get isStackedDiscreteBar(): boolean {
        return this.type === ChartTypeName.StackedDiscreteBar
    }

    @computed get isLineChartThatTurnedIntoDiscreteBar(): boolean {
        if (!this.isLineChart) return false

        // This is the easy case: minTime and maxTime are the same, no need to do
        // more fancy checks
        if (this.minTime === this.maxTime) return true

        // We can have cases where minTime = Infinity and/or maxTime = -Infinity,
        // but still only a single year is selected.
        // To check for that we need to look at the times array.
        const times = this.tableAfterAuthorTimelineFilter.timeColumn.uniqValues
        const minTime = findClosestTime(times, this.minTime ?? -Infinity)
        const maxTime = findClosestTime(times, this.maxTime ?? Infinity)
        return minTime !== undefined && minTime === maxTime
    }

    @computed get supportsMultipleYColumns(): boolean {
        return !(this.isScatter || this.isSlopeChart)
    }

    @computed private get xDimension(): ChartDimension | undefined {
        return this.filledDimensions.find(
            (d) => d.property === DimensionProperty.x
        )
    }

    // todo: this is only relevant for scatter plots and Marimekko. move to scatter plot class?
    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime(): number | undefined {
        return this.xDimension?.targetYear
    }

    // todo: this is only relevant for scatter plots and Marimekko. move to scatter plot class?
    set xOverrideTime(value: number | undefined) {
        this.xDimension!.targetYear = value
    }

    @computed get idealBounds(): Bounds {
        return new Bounds(0, 0, DEFAULT_GRAPHER_WIDTH, DEFAULT_GRAPHER_HEIGHT)
    }

    @computed get hasYDimension(): boolean {
        return this.dimensions.some((d) => d.property === DimensionProperty.y)
    }

    generateStaticSvg(bounds: Bounds = this.idealBounds): string {
        const _isExportingtoSvgOrPng = this.isExportingtoSvgOrPng
        this.isExportingtoSvgOrPng = true
        const staticSvg = ReactDOMServer.renderToStaticMarkup(
            <StaticCaptionedChart manager={this} bounds={bounds} />
        )
        this.isExportingtoSvgOrPng = _isExportingtoSvgOrPng
        return staticSvg
    }

    get staticSVG(): string {
        return this.generateStaticSvg()
    }

    @computed get disableIntroAnimation(): boolean {
        return this.isExportingtoSvgOrPng
    }

    @computed get mapConfig(): MapConfig {
        return this.map
    }

    @computed get cacheTag(): string {
        return this.version.toString()
    }

    @computed get mapIsClickable(): boolean {
        return (
            this.hasChartTab &&
            (this.isLineChart || this.isScatter) &&
            !isMobile()
        )
    }

    @computed get relativeToggleLabel(): string {
        if (this.isScatter) return "Display average annual change"
        else if (this.isLineChart) return "Display relative change"
        return "Display relative values"
    }

    // NB: The timeline scatterplot in relative mode calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
        // don't allow relative mode in some cases
        if (
            this.hasSingleMetricInFacets ||
            this.hasSingleEntityInFacets ||
            this.isStackedChartSplitByMetric
        )
            return false
        return this.stackMode === StackMode.relative
    }

    @computed get canToggleRelativeMode(): boolean {
        const {
            isLineChart,
            hideRelativeToggle,
            areHandlesOnSameTime,
            yScaleType,
            hasSingleEntityInFacets,
            hasSingleMetricInFacets,
            xColumnSlug,
            isMarimekko,
            isStackedChartSplitByMetric,
        } = this

        if (isLineChart)
            return (
                !hideRelativeToggle &&
                !areHandlesOnSameTime &&
                yScaleType !== ScaleType.log
            )

        // actually trying to exclude relative mode with just one metric or entity
        if (
            hasSingleEntityInFacets ||
            hasSingleMetricInFacets ||
            isStackedChartSplitByMetric
        )
            return false

        if (isMarimekko && xColumnSlug === undefined) return false
        return !hideRelativeToggle
    }

    // Filter data to what can be display on the map (across all times)
    @computed get mappableData(): OwidVariableRow<any>[] {
        return this.inputTable
            .get(this.mapColumnSlug)
            .owidRows.filter((row) => isOnTheMap(row.entityName))
    }

    static renderGrapherIntoContainer(
        config: GrapherProgrammaticInterface,
        containerNode: Element
    ): React.RefObject<Grapher> {
        const grapherInstanceRef = React.createRef<Grapher>()

        let ErrorBoundary = React.Fragment as React.ComponentType // use React.Fragment as a sort of default error boundary if Bugsnag is not available
        if (Bugsnag && (Bugsnag as any)._client) {
            ErrorBoundary =
                Bugsnag.getPlugin("react")?.createErrorBoundary(React) ??
                React.Fragment
        }

        const setBoundsFromContainerAndRender = (
            entries: ResizeObserverEntry[]
        ): void => {
            const entry = entries?.[0] // We always observe exactly one element
            if (!entry)
                throw new Error(
                    "Couldn't resize grapher, expected exactly one ResizeObserverEntry"
                )

            // Don't bother rendering if the container is hidden
            // see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
            if ((entry.target as HTMLElement).offsetParent === null) return

            const props: GrapherProgrammaticInterface = {
                ...config,
                bounds: Bounds.fromRect(entry.contentRect),
            }
            ReactDOM.render(
                <ErrorBoundary>
                    <Grapher ref={grapherInstanceRef} {...props} />
                </ErrorBoundary>,
                containerNode
            )
        }

        if (typeof window !== "undefined" && "ResizeObserver" in window) {
            const resizeObserver = new ResizeObserver(
                // Use a leading debounce to render immediately upon first load, and also immediately upon orientation change on mobile
                debounce(setBoundsFromContainerAndRender, 400, {
                    leading: true,
                })
            )
            resizeObserver.observe(containerNode)
        } else if (
            typeof window === "object" &&
            typeof document === "object" &&
            !navigator.userAgent.includes("jsdom")
        ) {
            // only show the warning when we're in something that roughly resembles a browser
            console.warn(
                "ResizeObserver not available; grapher will not be able to render"
            )
            Bugsnag?.notify("ResizeObserver not available")
        }

        return grapherInstanceRef
    }

    static renderSingleGrapherOnGrapherPage(
        jsonConfig: GrapherInterface
    ): void {
        const container = document.getElementsByTagName("figure")[0]
        try {
            Grapher.renderGrapherIntoContainer(
                {
                    ...jsonConfig,
                    bindUrlToWindow: true,
                    enableKeyboardShortcuts: true,
                    queryStr: window.location.search,
                },
                container
            )
        } catch (err) {
            container.innerHTML = `<img src="/grapher/exports/${jsonConfig.slug}.svg"/><p>Unable to load interactive visualization</p>`
            container.setAttribute("id", "fallback")
            throw err
        }
    }

    @computed get isMobile(): boolean {
        return isMobile()
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get isPortrait(): boolean {
        return (
            this.bounds.width < this.bounds.height &&
            this.bounds.width < DEFAULT_GRAPHER_WIDTH
        )
    }

    @computed private get widthForDeviceOrientation(): number {
        return this.isPortrait ? 400 : 680
    }

    @computed private get heightForDeviceOrientation(): number {
        return this.isPortrait ? 640 : 480
    }

    @computed private get useIdealBounds(): boolean {
        const {
            isEditor,
            isExportingtoSvgOrPng,
            bounds,
            widthForDeviceOrientation,
            heightForDeviceOrientation,
            isInIFrame,
            isInFullScreenMode,
            windowInnerWidth,
            windowInnerHeight,
        } = this

        // In full-screen mode, we usually use all space available to us
        // We use the ideal bounds only if the available space is very large
        if (isInFullScreenMode) {
            if (
                windowInnerHeight! > 2 * heightForDeviceOrientation &&
                windowInnerWidth! > 2 * widthForDeviceOrientation
            )
                return true
            return false
        }

        // For these, defer to the bounds that are set externally
        if (
            this.isEmbeddedInADataPage ||
            this.isEmbeddedInAnOwidPage ||
            this.props.manager ||
            isInIFrame
        )
            return false

        // If the user is using interactive version and then goes to export chart, use current bounds to maintain WYSIWYG
        if (isExportingtoSvgOrPng) return false

        // todo: can remove this if we drop old adminSite editor
        if (isEditor) return true

        // If the available space is very small, we use all of the space given to us
        if (
            bounds.height < heightForDeviceOrientation ||
            bounds.width < widthForDeviceOrientation
        )
            return false

        return true
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed private get scaleToFitIdeal(): number {
        const {
            bounds,
            isInFullScreenMode,
            widthForDeviceOrientation,
            heightForDeviceOrientation,
            windowInnerWidth,
            windowInnerHeight,
        } = this
        const givenBounds = isInFullScreenMode
            ? { width: windowInnerWidth!, height: windowInnerHeight! }
            : bounds
        return Math.min(
            (givenBounds.width * 0.95) / widthForDeviceOrientation,
            (givenBounds.height * 0.95) / heightForDeviceOrientation
        )
    }

    @computed private get fullScreenPadding(): number {
        const { windowInnerWidth } = this
        if (!windowInnerWidth) return 0
        return windowInnerWidth < 940 ? 0 : 40
    }

    // These are the final render dimensions
    @computed private get renderWidth(): number {
        const {
            bounds,
            isInFullScreenMode,
            useIdealBounds,
            widthForDeviceOrientation,
            scaleToFitIdeal,
            windowInnerWidth,
            fullScreenPadding,
        } = this

        if (useIdealBounds) {
            return Math.floor(widthForDeviceOrientation * scaleToFitIdeal)
        }

        return Math.floor(
            isInFullScreenMode
                ? windowInnerWidth! - 2 * fullScreenPadding
                : bounds.width
        )
    }

    @computed private get renderHeight(): number {
        const {
            bounds,
            isInFullScreenMode,
            useIdealBounds,
            heightForDeviceOrientation,
            scaleToFitIdeal,
            windowInnerHeight,
            fullScreenPadding,
        } = this

        if (useIdealBounds) {
            return Math.floor(heightForDeviceOrientation * scaleToFitIdeal)
        }

        return Math.floor(
            isInFullScreenMode
                ? windowInnerHeight! - 2 * fullScreenPadding
                : bounds.height
        )
    }

    @computed get tabBounds(): Bounds {
        return new Bounds(0, 0, this.renderWidth, this.renderHeight)
    }

    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get containerElement(): HTMLDivElement | undefined {
        return this.base.current || undefined
    }

    @observable private hasBeenVisible = false
    @observable private uncaughtError?: Error

    @action.bound setError(err: Error): void {
        this.uncaughtError = err
    }

    @action.bound clearErrors(): void {
        this.uncaughtError = undefined
    }

    private get commandPalette(): JSX.Element | null {
        return this.props.enableKeyboardShortcuts ? (
            <CommandPalette commands={this.keyboardShortcuts} display="none" />
        ) : null
    }

    formatTimeFn(time: Time): string {
        return this.inputTable.timeColumn.formatTime(time)
    }

    @action.bound private toggleTabCommand(): void {
        this.tab = next(this.availableTabs, this.tab)
    }

    @action.bound private togglePlayingCommand(): void {
        this.timelineController.togglePlay()
    }

    selection =
        this.manager?.selection ??
        new SelectionArray(
            this.props.selectedEntityNames ?? [],
            this.props.table?.availableEntities ?? []
        )

    @computed get availableEntities(): Entity[] {
        return this.tableForSelection.availableEntities
    }

    private get keyboardShortcuts(): Command[] {
        const temporaryFacetTestCommands = range(0, 10).map((num) => {
            return {
                combo: `${num}`,
                fn: (): void => this.randomSelection(num),
            }
        })
        const shortcuts = [
            ...temporaryFacetTestCommands,
            {
                combo: "t",
                fn: (): void => this.toggleTabCommand(),
                title: "Toggle tab",
                category: "Navigation",
            },
            {
                combo: "?",
                fn: (): void => CommandPalette.togglePalette(),
                title: `Toggle Help`,
                category: "Navigation",
            },
            {
                combo: "a",
                fn: (): void | SelectionArray =>
                    this.selection.hasSelection
                        ? this.selection.clearSelection()
                        : this.selection.selectAll(),
                title: this.selection.hasSelection
                    ? `Select None`
                    : `Select All`,
                category: "Selection",
            },
            {
                combo: "f",
                fn: (): void => {
                    this.hideFacetControl = !this.hideFacetControl
                },
                title: `Toggle Faceting`,
                category: "Chart",
            },
            {
                combo: "p",
                fn: (): void => this.togglePlayingCommand(),
                title: this.isPlaying ? `Pause` : `Play`,
                category: "Timeline",
            },
            {
                combo: "l",
                fn: (): void => this.toggleYScaleTypeCommand(),
                title: "Toggle Y log/linear",
                category: "Chart",
            },
            {
                combo: "w",
                fn: (): void => this.toggleFullScreenMode(),
                title: `Toggle full-screen mode`,
                category: "Chart",
            },
            {
                combo: "s",
                fn: (): void => {
                    this.isSourcesModalOpen = !this.isSourcesModalOpen
                },
                title: `Toggle sources modal`,
                category: "Chart",
            },
            {
                combo: "esc",
                fn: (): void => this.clearErrors(),
            },
            {
                combo: "z",
                fn: (): void => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "shift+o",
                fn: (): void => this.clearQueryParams(),
                title: "Reset to original",
                category: "Navigation",
            },
        ]

        if (this.slideShow) {
            const slideShow = this.slideShow
            shortcuts.push({
                combo: "right",
                fn: () => slideShow.playNext(),
                title: "Next chart",
                category: "Browse",
            })
            shortcuts.push({
                combo: "left",
                fn: () => slideShow.playPrevious(),
                title: "Previous chart",
                category: "Browse",
            })
        }

        return shortcuts
    }

    @observable slideShow?: SlideShowController<any>

    @action.bound private toggleTimelineCommand(): void {
        // Todo: add tests for this
        this.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.timeParam!)
        )
    }

    @action.bound private toggleYScaleTypeCommand(): void {
        this.yAxis.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.yAxis.scaleType
        )
    }

    @computed get _sortConfig(): Readonly<SortConfig> {
        return {
            sortBy: this.sortBy ?? SortBy.total,
            sortOrder: this.sortOrder ?? SortOrder.desc,
            sortColumnSlug: this.sortColumnSlug,
        }
    }

    @computed get sortConfig(): SortConfig {
        const sortConfig = { ...this._sortConfig }
        // In relative mode, where the values for every entity sum up to 100%, sorting by total
        // doesn't make sense. It's also jumpy because of some rounding errors. For this reason,
        // we sort by entity name instead.
        // Marimekko charts are special and there we don't do this forcing of sort order
        if (
            !this.isMarimekko &&
            this.isRelativeMode &&
            sortConfig.sortBy === SortBy.total
        ) {
            sortConfig.sortBy = SortBy.entityName
            sortConfig.sortOrder = SortOrder.asc
        }
        return sortConfig
    }

    @computed get hasMultipleYColumns(): boolean {
        return this.yColumnSlugs.length > 1
    }

    @computed private get hasSingleMetricInFacets(): boolean {
        const {
            isStackedDiscreteBar,
            isStackedArea,
            isStackedBar,
            selectedFacetStrategy,
            hasMultipleYColumns,
        } = this

        if (isStackedDiscreteBar) {
            return (
                selectedFacetStrategy === FacetStrategy.entity ||
                selectedFacetStrategy === FacetStrategy.metric
            )
        }

        if (isStackedArea || isStackedBar) {
            return (
                selectedFacetStrategy === FacetStrategy.entity &&
                !hasMultipleYColumns
            )
        }

        return false
    }

    @computed private get hasSingleEntityInFacets(): boolean {
        const {
            isStackedArea,
            isStackedBar,
            selectedFacetStrategy,
            selection,
        } = this

        if (isStackedArea || isStackedBar) {
            return (
                selectedFacetStrategy === FacetStrategy.metric &&
                selection.numSelectedEntities === 1
            )
        }

        return false
    }

    // TODO: remove once #2136 is fixed
    // issue #2136 describes a serious bug that relates to relative mode and
    // affects all stacked area/bar charts that are split by metric. for now,
    // we simply turn off relative mode in such cases. once the bug is properly
    // addressed, this computed property and its references can be removed
    @computed
    private get isStackedChartSplitByMetric(): boolean {
        return (
            (this.isStackedArea || this.isStackedBar) &&
            this.selectedFacetStrategy === FacetStrategy.metric
        )
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        return this.chartInstance.availableFacetStrategies?.length
            ? this.chartInstance.availableFacetStrategies
            : [FacetStrategy.none]
    }

    // the actual facet setting used by a chart, potentially overriding selectedFacetStrategy
    @computed get facetStrategy(): FacetStrategy {
        if (
            this.selectedFacetStrategy &&
            this.availableFacetStrategies.includes(this.selectedFacetStrategy)
        )
            return this.selectedFacetStrategy

        return firstOfNonEmptyArray(this.availableFacetStrategies)
    }

    set facetStrategy(facet: FacetStrategy) {
        this.selectedFacetStrategy = facet
    }

    @action.bound randomSelection(num: number): void {
        // Continent, Population, GDP PC, GDP, PopDens, UN, Language, etc.
        this.clearErrors()
        const currentSelection = this.selection.selectedEntityNames.length
        const newNum = num ? num : currentSelection ? currentSelection * 2 : 10
        this.selection.setSelectedEntities(
            sampleFrom(this.selection.availableEntityNames, newNum, Date.now())
        )
    }

    @computed get isInFullScreenMode(): boolean {
        return this._isInFullScreenMode
    }

    set isInFullScreenMode(newValue: boolean) {
        // prevent scrolling when in full-screen mode
        if (newValue) {
            document.documentElement.classList.add("no-scroll")
        } else {
            document.documentElement.classList.remove("no-scroll")
        }

        // dismiss the share menu
        this.isShareMenuActive = false

        this._isInFullScreenMode = newValue
    }

    @action.bound toggleFullScreenMode(): void {
        this.isInFullScreenMode = !this.isInFullScreenMode
    }

    @action.bound dismissFullScreen(): void {
        // if a modal is open, dismiss it instead of exiting full-screen mode
        if (this.isModalOpen || this.isShareMenuActive) {
            this.isSelectingData = false
            this.isSourcesModalOpen = false
            this.isEmbedModalOpen = false
            this.isDownloadModalOpen = false
            this.isShareMenuActive = false
        } else {
            this.isInFullScreenMode = false
        }
    }

    @computed private get isModalOpen(): boolean {
        return (
            this.isSelectingData ||
            this.isSourcesModalOpen ||
            this.isEmbedModalOpen ||
            this.isDownloadModalOpen
        )
    }

    private renderError(): JSX.Element {
        return (
            <div
                title={this.uncaughtError?.message}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    textAlign: "center",
                    lineHeight: 1.5,
                    padding: "3rem",
                }}
            >
                <p style={{ color: "#cc0000", fontWeight: 700 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    {ThereWasAProblemLoadingThisChart}
                </p>
                <p>
                    We have been notified of this error, please check back later
                    whether it's been fixed. If the error persists, get in touch
                    with us at{" "}
                    <a
                        href={`mailto:info@ourworldindata.org?subject=Broken chart on page ${window.location.href}`}
                    >
                        info@ourworldindata.org
                    </a>
                    .
                </p>
                {this.uncaughtError && this.uncaughtError.message && (
                    <pre style={{ fontSize: "11px" }}>
                        Error: {this.uncaughtError.message}
                    </pre>
                )}
            </div>
        )
    }

    @action.bound
    resetAnnotation(): void {
        this.renderAnnotation(undefined)
    }

    @action.bound
    renderAnnotation(annotation: Annotation | undefined): void {
        this.setAuthoredVersion(this.props)
        this.reset()
        this.updateFromObject({ ...this.props })
        this.populateFromQueryParams(
            legacyToCurrentGrapherQueryParams(this.props.queryStr ?? "")
        )
        this.annotation = annotation
    }

    private renderGrapherComponent(): JSX.Element {
        const containerClasses = classnames({
            GrapherComponent: true,
            GrapherPortraitClass: this.isPortrait,
            isExportingToSvgOrPng: this.isExportingtoSvgOrPng,
            optimizeForHorizontalSpace: this.optimizeForHorizontalSpace,
            GrapherComponentNarrow: this.isNarrow,
            GrapherComponentSemiNarrow: this.isSemiNarrow,
            GrapherComponentSmall: this.isSmall,
            GrapherComponentMedium: this.isMedium,
        })

        const containerStyle = {
            width: this.renderWidth,
            height: this.renderHeight,
            fontSize: this.isExportingtoSvgOrPng
                ? 18
                : Math.min(16, this.baseFontSize), // cap font size at 16px
        }

        return (
            <div
                ref={this.base}
                className={containerClasses}
                style={containerStyle}
                data-grapher-url={this.canonicalUrl}
            >
                {this.commandPalette}
                {this.uncaughtError ? this.renderError() : this.renderReady()}
            </div>
        )
    }

    render(): JSX.Element | undefined {
        // TODO how to handle errors in exports?
        // TODO remove this? should have a simple toStaticSVG for exporting
        if (this.isExportingtoSvgOrPng) return <CaptionedChart manager={this} />

        if (this.isInFullScreenMode) {
            return (
                <FullScreen
                    onDismiss={this.dismissFullScreen}
                    overlayColor={this.isModalOpen ? "#999999" : "#fff"}
                >
                    {this.renderGrapherComponent()}
                </FullScreen>
            )
        }

        return this.renderGrapherComponent()
    }

    private renderReady(): JSX.Element | null {
        if (!this.hasBeenVisible) return null
        return (
            <>
                <CaptionedChart manager={this} />
                <TooltipContainer
                    containerWidth={this.renderWidth}
                    containerHeight={this.renderHeight}
                    tooltipProvider={this}
                />
                {this.isSourcesModalOpen && <SourcesModal manager={this} />}
                {this.isDownloadModalOpen && <DownloadModal manager={this} />}
                {this.isEmbedModalOpen && <EmbedModal manager={this} />}
                {this.isSelectingData && <EntitySelectorModal manager={this} />}
            </>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound private setUpIntersectionObserver(): void {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.hasBeenVisible = true
                        observer.disconnect()
                    }
                })
            })
            observer.observe(this.containerElement!)
            this.disposers.push(() => observer.disconnect())
        } else {
            // IntersectionObserver not available; we may be in a Node environment, just render
            this.hasBeenVisible = true
        }
    }

    @action.bound private setBaseFontSize(): void {
        const { renderWidth } = this
        if (renderWidth <= 400) this.baseFontSize = 14
        else if (renderWidth < 1080) this.baseFontSize = 16
        else if (renderWidth >= 1080) this.baseFontSize = 18
    }

    // when optimized for horizontal screen, grapher bleeds onto the edges horizontally
    @computed get framePaddingHorizontal(): number {
        return this.optimizeForHorizontalSpace
            ? 0
            : DEFAULT_GRAPHER_FRAME_PADDING
    }

    @computed get framePaddingVertical(): number {
        return DEFAULT_GRAPHER_FRAME_PADDING
    }

    @computed get isNarrow(): boolean {
        if (this.isExportingtoSvgOrPng) return false
        return this.renderWidth <= 400
    }

    // SemiNarrow charts shorten their button labels to fit within the controls row
    @computed get isSemiNarrow(): boolean {
        if (this.isExportingtoSvgOrPng) return false
        return this.renderWidth <= 550
    }

    // Small charts are rendered into 6 or 7 columns in a 12-column grid layout
    // (e.g. side-by-side charts or charts in the All Charts block)
    @computed get isSmall(): boolean {
        if (this.isExportingtoSvgOrPng) return false
        return this.renderWidth <= 740
    }

    // Medium charts are rendered into 8 columns in a 12-column grid layout
    // (e.g. stand-alone charts in the main text of an article)
    @computed get isMedium(): boolean {
        if (this.isExportingtoSvgOrPng) return false
        return this.renderWidth <= 840
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    private bindToWindow(): void {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = (): void =>
            setWindowQueryStr(queryParamsToStr(this.changedParams))
        const debouncedPushParams = debounce(pushParams, 100)

        reaction(
            () => this.changedParams,
            () => (this.debounceMode ? debouncedPushParams() : pushParams())
        )

        autorun(() => (document.title = this.currentTitle))
    }

    @action.bound private setUpWindowResizeEventHandler(): void {
        const updateWindowDimensions = (): void => {
            this.windowInnerWidth = window.innerWidth
            this.windowInnerHeight = window.innerHeight
        }
        const onResize = debounce(updateWindowDimensions, 400, {
            leading: true,
        })

        if (typeof window !== "undefined") {
            updateWindowDimensions()
            window.addEventListener("resize", onResize)
            this.disposers.push(() => {
                window.removeEventListener("resize", onResize)
            })
        }
    }

    componentDidMount(): void {
        this.setBaseFontSize()
        this.setUpIntersectionObserver()
        this.setUpWindowResizeEventHandler()
        exposeInstanceOnWindow(this, "grapher")
        if (this.props.bindUrlToWindow) this.bindToWindow()
        if (this.props.enableKeyboardShortcuts) this.bindKeyboardShortcuts()
    }

    private _shortcutsBound = false
    private bindKeyboardShortcuts(): void {
        if (this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.bind(shortcut.combo, () => {
                shortcut.fn()
                this.analytics.logKeyboardShortcut(
                    shortcut.title || "",
                    shortcut.combo
                )
                return false
            })
        })
        this._shortcutsBound = true
    }

    private unbindKeyboardShortcuts(): void {
        if (!this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.unbind(shortcut.combo)
        })
        this._shortcutsBound = false
    }

    componentWillUnmount(): void {
        this.unbindKeyboardShortcuts()
        this.dispose()
    }

    componentDidUpdate(): void {
        this.setBaseFontSize()
    }

    componentDidCatch(error: Error): void {
        this.setError(error)
        this.analytics.logGrapherViewError(error)
    }

    @observable isShareMenuActive = false

    @computed get hasRelatedQuestion(): boolean {
        if (this.hideRelatedQuestion || !this.relatedQuestions.length)
            return false
        const question = this.relatedQuestions[0]
        return !!question && !!question.text && !!question.url
    }

    @computed get isRelatedQuestionTargetDifferentFromCurrentPage(): boolean {
        // comparing paths rather than full URLs for this to work as
        // expected on local and staging where the origin (e.g.
        // hans.owid.cloud) doesn't match the production origin that has
        // been entered in the related question URL field:
        // "ourworldindata.org" and yet should still yield a match.
        // - Note that this won't work on production previews (where the
        //   path is /admin/posts/preview/ID)
        const { hasRelatedQuestion } = this
        return (
            hasRelatedQuestion &&
            getWindowUrl().pathname !==
                Url.fromURL(this.relatedQuestions[0]?.url).pathname
        )
    }

    @action.bound clearSelection(): void {
        this.selection.clearSelection()
        this.applyOriginalSelectionAsAuthored()
    }

    @action.bound clearQueryParams(): void {
        const { authorsVersion } = this
        this.tab = authorsVersion.tab
        this.xAxis.scaleType = authorsVersion.xAxis.scaleType
        this.yAxis.scaleType = authorsVersion.yAxis.scaleType
        this.stackMode = authorsVersion.stackMode
        this.zoomToSelection = authorsVersion.zoomToSelection
        this.compareEndPointsOnly = authorsVersion.compareEndPointsOnly
        this.minTime = authorsVersion.minTime
        this.maxTime = authorsVersion.maxTime
        this.map.time = authorsVersion.map.time
        this.map.projection = authorsVersion.map.projection
        this.clearSelection()
    }

    // Todo: come up with a more general pattern?
    // The idea here is to reset the Grapher to a blank slate, so that if you updateFromObject and the object contains some blanks, those blanks
    // won't overwrite defaults (like type == LineChart). RAII would probably be better, but this works for now.
    @action.bound reset(): void {
        const grapher = new Grapher()
        this.title = grapher.title
        this.subtitle = grapher.subtitle
        this.note = grapher.note
        this.type = grapher.type
        this.ySlugs = grapher.ySlugs
        this.xSlug = grapher.xSlug
        this.colorSlug = grapher.colorSlug
        this.sizeSlug = grapher.sizeSlug
        this.hasMapTab = grapher.hasMapTab
        this.selectedFacetStrategy = FacetStrategy.none
        this.hasChartTab = grapher.hasChartTab
        this.map = grapher.map
        this.yAxis.scaleType = grapher.yAxis.scaleType
        this.yAxis.min = grapher.yAxis.min
        this.sortBy = grapher.sortBy
        this.sortOrder = grapher.sortOrder
        this.sortColumnSlug = grapher.sortColumnSlug
        this.hideRelativeToggle = grapher.hideRelativeToggle
        this.dimensions = grapher.dimensions
        this.stackMode = grapher.stackMode
        this.hideTotalValueLabel = grapher.hideTotalValueLabel
        this.hideAnnotationFieldsInTitle = grapher.hideAnnotationFieldsInTitle
        this.timelineMinTime = grapher.timelineMinTime
        this.timelineMaxTime = grapher.timelineMaxTime
        this.relatedQuestions = grapher.relatedQuestions
        this.sourceDesc = grapher.sourceDesc
    }

    debounceMode = false

    @computed.struct get allParams(): GrapherQueryParams {
        const params: GrapherQueryParams = {}
        params.tab = this.tab
        params.xScale = this.xAxis.scaleType
        params.yScale = this.yAxis.scaleType
        params.stackMode = this.stackMode
        params.zoomToSelection = this.zoomToSelection ? "true" : undefined
        params.endpointsOnly = this.compareEndPointsOnly ? "1" : "0"
        params.time = this.timeParam
        params.region = this.map.projection
        params.facet = this.selectedFacetStrategy
        params.uniformYAxis =
            this.yAxis.facetDomain === FacetAxisDomain.independent ? "0" : "1"
        return setSelectedEntityNamesParam(
            Url.fromQueryParams(params),
            this.selectedEntitiesIfDifferentThanAuthors
        ).queryParams
    }

    @computed private get selectedEntitiesIfDifferentThanAuthors():
        | EntityName[]
        | undefined {
        const authoredConfig = this.legacyConfigAsAuthored

        const originalSelectedEntityNames =
            authoredConfig.selectedEntityNames ?? []
        const currentSelectedEntityNames = this.selection.selectedEntityNames

        const entityNamesThatTheUserDeselected = difference(
            currentSelectedEntityNames,
            originalSelectedEntityNames
        )

        if (
            currentSelectedEntityNames.length !==
                originalSelectedEntityNames.length ||
            entityNamesThatTheUserDeselected.length
        )
            return this.selection.selectedEntityNames

        return undefined
    }

    // Autocomputed url params to reflect difference between current grapher state
    // and original config state
    @computed.struct get changedParams(): Partial<GrapherQueryParams> {
        return differenceObj(this.allParams, this.authorsVersion.allParams)
    }

    // If you want to compare current state against the published grapher.
    @computed private get authorsVersion(): Grapher {
        return new Grapher({
            ...this.legacyConfigAsAuthored,
            getGrapherInstance: undefined,
            manager: undefined,
            manuallyProvideData: true,
            queryStr: "",
        })
    }

    @computed get queryStr(): string {
        return queryParamsToStr(this.changedParams)
    }

    @computed get baseUrl(): string | undefined {
        return this.isPublished
            ? `${this.bakedGrapherURL ?? "/grapher"}/${this.displaySlug}`
            : undefined
    }

    @computed private get manager(): GrapherManager | undefined {
        return this.props.manager
    }

    // Get the full url representing the canonical location of this grapher state
    @computed get canonicalUrl(): string | undefined {
        return (
            this.manager?.canonicalUrl ??
            (this.baseUrl ? this.baseUrl + this.queryStr : undefined)
        )
    }

    @computed get isOnCanonicalUrl(): boolean {
        if (!this.canonicalUrl) return false
        return (
            getWindowUrl().pathname === Url.fromURL(this.canonicalUrl).pathname
        )
    }

    @computed get embedUrl(): string | undefined {
        return this.manager?.embedDialogUrl ?? this.canonicalUrl
    }

    @computed get embedDialogAdditionalElements():
        | React.ReactElement
        | undefined {
        return this.manager?.embedDialogAdditionalElements
    }

    @computed private get hasUserChangedTimeHandles(): boolean {
        const authorsVersion = this.authorsVersion
        return (
            this.minTime !== authorsVersion.minTime ||
            this.maxTime !== authorsVersion.maxTime
        )
    }

    @computed private get hasUserChangedMapTimeHandle(): boolean {
        return this.map.time !== this.authorsVersion.map.time
    }

    @computed get timeParam(): string | undefined {
        const { timeColumn } = this.table
        const formatTime = (t: Time): string =>
            timeBoundToTimeBoundString(
                t,
                timeColumn instanceof ColumnTypeMap.Day
            )

        if (this.isOnMapTab) {
            return this.map.time !== undefined &&
                this.hasUserChangedMapTimeHandle
                ? formatTime(this.map.time)
                : undefined
        }

        if (!this.hasUserChangedTimeHandles) return undefined

        const [startTime, endTime] =
            this.timelineHandleTimeBounds.map(formatTime)
        return startTime === endTime ? startTime : `${startTime}..${endTime}`
    }

    msPerTick = DEFAULT_MS_PER_TICK

    timelineController = new TimelineController(this)

    // todo: restore this behavior??
    onStartPlayOrDrag(): void {
        this.debounceMode = true
    }

    onStopPlayOrDrag(): void {
        this.debounceMode = false
    }

    @computed get disablePlay(): boolean {
        return this.isSlopeChart
    }

    formatTime(value: Time): string {
        const timeColumn = this.table.timeColumn
        return isMobile()
            ? timeColumn.formatValueForMobile(value)
            : timeColumn.formatValue(value)
    }

    @computed get showChangeEntityButton(): boolean {
        return !this.hideEntityControls && this.canChangeEntity
    }

    @computed get showAddEntityButton(): boolean {
        return (
            !this.hideEntityControls &&
            this.canSelectMultipleEntities &&
            (this.isLineChart ||
                this.isStackedArea ||
                this.isDiscreteBar ||
                this.isStackedDiscreteBar)
        )
    }

    @computed get showSelectEntitiesButton(): boolean {
        return (
            !this.hideEntityControls &&
            this.addCountryMode !== EntitySelectionMode.Disabled &&
            this.numSelectableEntityNames > 1 &&
            !this.showAddEntityButton &&
            !this.showChangeEntityButton
        )
    }

    @computed get canSelectMultipleEntities(): boolean {
        if (this.numSelectableEntityNames < 2) return false
        if (this.addCountryMode === EntitySelectionMode.MultipleEntities)
            return true
        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.facetStrategy !== FacetStrategy.none
        )
            return true

        return false
    }

    // This is just a helper method to return the correct table for providing entity choices. We want to
    // provide the root table, not the transformed table.
    // A user may have added time or other filters that would filter out all rows from certain entities, but
    // we may still want to show those entities as available in a picker. We also do not want to do things like
    // hide the Add Entity button as the user drags the timeline.
    @computed private get numSelectableEntityNames(): number {
        return this.selection.numAvailableEntityNames
    }

    @computed get canChangeEntity(): boolean {
        return (
            !this.isScatter &&
            !this.canSelectMultipleEntities &&
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.numSelectableEntityNames > 1
        )
    }

    @computed get entitiesAreCountryLike(): boolean {
        return !!this.entityType.match(/\bcountry\b/i)
    }

    @computed get startSelectingWhenLineClicked(): boolean {
        return this.showAddEntityButton && !this.isMobile
    }

    // For now I am only exposing this programmatically for the dashboard builder. Setting this to true
    // allows you to still use add country "modes" without showing the buttons in order to prioritize
    // another entity selector over the built in ones.
    @observable hideEntityControls = false

    // exposed programmatically for hiding interactive controls or tabs when desired
    // (e.g. used to hide Grapher chrome when a Grapher chart in a Gdoc article is in "read-only" mode)
    @observable hideZoomToggle = false
    @observable hideNoDataAreaToggle = false
    @observable hideFacetYDomainToggle = false
    @observable hideXScaleToggle = false
    @observable hideYScaleToggle = false
    @observable hideMapProjectionMenu = false
    @observable hideTableFilterToggle = false
    // enforces hiding an annotation, even if that means that a crucial piece of information is missing from the chart title
    @observable forceHideAnnotationFieldsInTitle: AnnotationFieldsInTitle = {
        entity: false,
        time: false,
        changeInPrefix: false,
    }
    @observable hasTableTab = true
    @observable hideShareButton = false
    @observable hideExploreTheDataButton = true
    @observable hideRelatedQuestion = false
}

const defaultObject = objectWithPersistablesToObject(
    new Grapher(),
    grapherKeysToSerialize
)

export const getErrorMessageRelatedQuestionUrl = (
    question: RelatedQuestionsConfig
): string | undefined => {
    return question.text
        ? (!question.url && "Missing URL") ||
              (!question.url.match(/^https?:\/\//) &&
                  "URL should start with http(s)://") ||
              undefined
        : undefined
}
