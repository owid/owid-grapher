import {
    MarkdownTextWrap,
    sumTextWrapHeights,
    reactRenderToStringClientOnly,
} from "@ourworldindata/components"
import {
    OwidTable,
    BlankOwidTable,
    CoreColumn,
    ColumnTypeMap,
    TimeColumn,
    MissingColumn,
} from "@ourworldindata/core-table"
import {
    GrapherChartType,
    GRAPHER_CHART_TYPES,
    AnnotationFieldsInTitle,
    TimeBound,
    Time,
    EntitySelectionMode,
    StackMode,
    LogoOption,
    GrapherTabConfigOption,
    GRAPHER_TAB_CONFIG_OPTIONS,
    ColorSchemeName,
    ScatterPointLabelStrategy,
    MissingDataStrategy,
    ColumnSlugs,
    ColumnSlug,
    EntityName,
    SeriesName,
    ComparisonLineConfig,
    RelatedQuestionsConfig,
    FacetStrategy,
    SortBy,
    SortOrder,
    QueryParams,
    LegacyGrapherInterface,
    ArchiveContext,
    AdditionalGrapherDataFetchFn,
    GrapherInterface,
    grapherKeysToSerialize,
    GrapherQueryParams,
    GRAPHER_QUERY_PARAM_KEYS,
    ScaleType,
    FacetAxisDomain,
    TimeBounds,
    GrapherTabName,
    GRAPHER_TAB_NAMES,
    AxisConfigInterface,
    SeriesStrategy,
    GRAPHER_MAP_TYPE,
    GrapherVariant,
    SeriesColorMap,
    OwidChartDimensionInterface,
    DimensionProperty,
    DetailsMarker,
    EnrichedDetail,
    ProjectionColumnInfo,
    OwidColumnDef,
    SortConfig,
    Color,
    GlobeRegionName,
    GrapherWindowType,
    MapRegionName,
} from "@ourworldindata/types"
import {
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    minTimeToJSON,
    maxTimeToJSON,
    updatePersistables,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    parseFloatOrUndefined,
    Url,
    getTimeDomainFromQueryString,
    findClosestTime,
    Bounds,
    excludeUndefined,
    isInIFrame,
    slugify,
    extractDetailsFromSyntax,
    lowerCaseFirstLetterUnlessAbbreviation,
    getOriginAttributionFragments,
    isTouchDevice,
    omitUndefinedValues,
    firstOfNonEmptyArray,
    getWindowUrl,
    isArrayDifferentFromReference,
    differenceObj,
    queryParamsToStr,
    timeBoundToTimeBoundString,
    getRegionByName,
    checkIsCountry,
    checkIsOwidContinent,
    checkIsIncomeGroup,
    checkHasMembers,
    sortNumeric,
} from "@ourworldindata/utils"
import Cookies from "js-cookie"
import * as _ from "lodash-es"
import {
    computed,
    action,
    makeObservable,
    observable,
    autorun,
    runInAction,
} from "mobx"
import React from "react"
import * as R from "remeda"
import { match } from "ts-pattern"
import { AxisConfig, AxisManager } from "../axis/AxisConfig.js"
import {
    GrapherRasterizeFn,
    StaticChartRasterizer,
} from "../captionedChart/StaticChartRasterizer.js"
import { Chart } from "../chart/Chart.js"
import {
    ChartDimension,
    LegacyDimensionsManager,
} from "../chart/ChartDimension.js"
import { ChartState } from "../chart/ChartInterface.js"
import {
    isChartTypeName,
    isChartTab,
    isMapTab,
    findValidChartTypeCombination,
    isValidTabConfigOption,
    mapChartTypeNameToTabConfigOption,
    mapTabConfigOptionToChartTypeName,
} from "../chart/ChartTabs.js"
import { makeChartState } from "../chart/ChartTypeMap.js"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
} from "../chart/ChartUtils.js"
import { DimensionSlot } from "../chart/DimensionSlot.js"
import {
    GRAPHER_LIGHT_TEXT,
    GRAPHER_BACKGROUND_DEFAULT,
} from "../color/ColorConstants.js"
import { ColorScaleConfig } from "../color/ColorScaleConfig.js"
import { isValidDataTableFilter } from "../dataTable/DataTable.js"
import {
    DataTableConfig,
    DataTableManager,
} from "../dataTable/DataTableConstants.js"
import {
    type EntitySelectorState,
    EntitySelector,
} from "../entitySelector/EntitySelector.js"
import { FacetChart } from "../facet/FacetChart.js"
import { FocusArray } from "../focus/FocusArray.js"
import { GlobeController } from "../mapCharts/GlobeController.js"
import {
    MAP_REGION_LABELS,
    MAP_REGION_NAMES,
    MapChartManager,
} from "../mapCharts/MapChartConstants.js"
import { MapConfig } from "../mapCharts/MapConfig.js"
import {
    isValidMapRegionName,
    getCountriesByRegion,
} from "../mapCharts/MapHelpers.js"
import {
    DownloadModalManager,
    DownloadModalTabName,
} from "../modal/DownloadModal.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { SlideShowController } from "../slideshowController/SlideShowController.js"
import {
    TimelineDragTarget,
    TimelineController,
    TimelineManager,
} from "../timeline/TimelineController.js"
import { TooltipManager } from "../tooltip/TooltipProps.js"
import {
    EntityRegionTypeGroup,
    groupEntityNamesByRegionType,
    EntityNamesByRegionType,
    isEntityRegionType,
} from "./EntitiesByRegionType.js"
import {
    getEntityNamesParam,
    getSelectedEntityNamesParam,
    getFocusedSeriesNamesParam,
} from "./EntityUrlBuilder.js"
import {
    MinimalNarrativeChartInfo,
    GrapherProgrammaticInterface,
    GrapherManager,
} from "./Grapher.js"
import { GrapherAnalytics } from "./GrapherAnalytics.js"
import {
    type GrapherAnalyticsContext,
    type EntitySelectorEvent,
    type GrapherImageDownloadEvent,
    type GrapherInteractionEvent,
} from "@ourworldindata/types"
import {
    latestGrapherConfigSchema,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_FRAME_PADDING_VERTICAL,
    DEFAULT_GRAPHER_BOUNDS,
    GrapherModal,
    CookieKey,
    GRAPHER_PROD_URL,
    BASE_FONT_SIZE,
    isContinentsVariableId,
    isPopulationVariableETLPath,
    DEFAULT_GRAPHER_WIDTH,
    DEFAULT_GRAPHER_HEIGHT,
    STATIC_EXPORT_DETAIL_SPACING,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    CHART_TYPES_THAT_SHOW_ALL_ENTITIES,
} from "./GrapherConstants.js"
import { parseGlobeRotation, grapherObjectToQueryParams } from "./GrapherUrl.js"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations.js"
import { getErrorMessageRelatedQuestionUrl } from "./relatedQuestion.js"
import { ChartManager } from "../chart/ChartManager.js"
import { CaptionedChartManager } from "../captionedChart/CaptionedChart.js"
import { SourcesModalManager } from "../modal/SourcesModal.js"
import { DiscreteBarChartManager } from "../barCharts/DiscreteBarChartConstants.js"
import { ShareMenuManager } from "../controls/ShareMenu.js"
import { EmbedModalManager } from "../modal/EmbedModal.js"
import { ScatterPlotManager } from "../scatterCharts/ScatterPlotChartConstants.js"
import { MarimekkoChartManager } from "../stackedCharts/MarimekkoChartConstants.js"
import { FacetChartManager } from "../facet/FacetChartConstants.js"
import { EntitySelectorModalManager } from "../modal/EntitySelectorModal.js"
import { SettingsMenuManager } from "../controls/SettingsMenu.js"
import { SlopeChartManager } from "../slopeCharts/SlopeChartConstants.js"

export class GrapherState
    implements
        AxisManager,
        TooltipManager,
        CaptionedChartManager,
        ChartManager,
        DiscreteBarChartManager,
        ScatterPlotManager,
        MarimekkoChartManager,
        MapChartManager,
        SlopeChartManager,
        DataTableManager,
        FacetChartManager,
        TimelineManager,
        SettingsMenuManager,
        EntitySelectorModalManager,
        DownloadModalManager,
        SourcesModalManager,
        EmbedModalManager,
        ShareMenuManager,
        LegacyDimensionsManager
{
    //
    // Chart settings persisted in the config
    //

    /** Url of the concrete schema version to use to validate this document */
    $schema = latestGrapherConfigSchema

    /** Internal database id */
    id: number | undefined = undefined

    /** Chart config version */
    version = 1

    /** Slug of the chart on Our World In Data */
    slug: string | undefined = undefined

    /** Big title text of the chart */
    title: string | undefined = undefined

    /** The longer subtitle text to show beneath the title */
    subtitle: string | undefined = undefined

    /** Indicates if the chart is published on Our World In Data or still in draft */
    isPublished: boolean | undefined = undefined

    /** The page containing this chart where more context can be found */
    originUrl: string | undefined = undefined

    /** Short comma-separated list of source names */
    sourceDesc: string | undefined = undefined

    /** Note displayed in the footer of the chart */
    note: string | undefined = undefined

    /** Additional text used internally to differentiate charts with the same title */
    internalNotes: string | undefined = undefined

    /** Optional internal variant name for distinguishing charts with the same title */
    variantName: string | undefined = undefined

    /** List of dimensions and their mapping to variables */
    dimensions: ChartDimension[] = []

    /** The initial selection of entities */
    selectedEntityNames: EntityName[] = []

    /** The initially focused chart elements. Is either a list of entity or variable names. Only works for line and slope charts for now. */
    focusedSeriesNames: SeriesName[] = []

    /** Entities that should be excluded (opposite of includedEntityNames) */
    excludedEntityNames: EntityName[] | undefined = undefined

    /** Entities that should be included (opposite of excludedEntityNames). If empty, all available entities are used. If set, all entities not specified here are excluded. excludedEntityNames are evaluated afterwards and can still remove entities even if they were included before. */
    includedEntityNames: EntityName[] | undefined = undefined

    /** Colors for selected entities */
    selectedEntityColors: { [entityName: string]: string | undefined } = {}

    /** Whether the user can change countries, add additional ones or neither */
    addCountryMode = EntitySelectionMode.MultipleEntities

    /**
     * Display string for naming the primary entities of the data.
     *
     * The default is 'country or region', but you can specify a different one
     * such as 'state' or 'region'
     */
    entityType = DEFAULT_GRAPHER_ENTITY_TYPE

    /** Plural of the entity type (e.g. when entityType is 'country' this would be 'countries') */
    entityTypePlural = DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL

    /**
     * Display string that replaces 'metric' in the 'Split by metric' label in
     * facet controls (e.g. 'product' displays 'Split by product')
     */
    facettingLabelByYVariables = "metric"

    /** Which chart types should be shown */
    chartTypes: GrapherChartType[] = [
        GRAPHER_CHART_TYPES.LineChart,
        GRAPHER_CHART_TYPES.DiscreteBar,
    ]

    /** Indicates if the map tab should be shown */
    hasMapTab = false

    /** The tab that is shown initially */
    tab: GrapherTabConfigOption = GRAPHER_TAB_CONFIG_OPTIONS.chart

    /** Configuration of the x-axis */
    xAxis = new AxisConfig(undefined, this)

    /** Configuration of the y-axis */
    yAxis = new AxisConfig(undefined, this)

    /** Color scale definition */
    colorScale = new ColorScaleConfig()

    /** Configuration of the world map chart */
    map = new MapConfig()

    /** One of the predefined base color schemes. If not provided, a default is automatically chosen based on the chart type. */
    baseColorScheme: ColorSchemeName | undefined = undefined

    /** Reverse the order of colors in the color scheme */
    invertColorScheme: boolean | undefined = undefined

    /** Which logo to show on the upper right side */
    logo: LogoOption | undefined = undefined

    /** Whether to hide the legend */
    hideLegend: boolean | undefined = false

    /** Whether to hide the logo */
    hideLogo: boolean | undefined = undefined

    /** Whether to hide the relative mode UI toggle */
    hideRelativeToggle: boolean | undefined = true

    /** Whether to hide connecting lines on scatter plots when a time range is selected */
    hideConnectedScatterLines: boolean | undefined = undefined

    /** Hide entity names in Scatter plots */
    hideScatterLabels: boolean | undefined = undefined

    /** Whether to hide the total value label (used on stacked discrete bar charts) */
    hideTotalValueLabel: boolean | undefined = undefined

    /** Whether to hide the faceting control */
    hideFacetControl = true

    /** Whether to hide any automatically added title annotations like the selected year */
    hideAnnotationFieldsInTitle: AnnotationFieldsInTitle | undefined = undefined

    /** Start point of the initially selected time span */
    minTime: TimeBound | undefined = undefined

    /** End point of the initially selected time span */
    maxTime: TimeBound | undefined = undefined

    /**
     * The lowest year to show in the timeline.
     *
     * If this is set then the user is not able to see any data before this year.
     * If set to "earliest", then the earliest year in the data is used.
     */
    timelineMinTime: Time | undefined = undefined

    /** The highest year to show in the timeline.
     *
     * If this is set then the user is not able to see any data after this year.
     * If set to "latest", then the latest year in the data is used.
     */
    timelineMaxTime: Time | undefined = undefined

    /**
     * Whether to hide the timeline from the user. If it is hidden then the
     * user can't change the time
     */
    hideTimeline: boolean | undefined = undefined

    /** Stack mode. Only absolute and relative are actively used. */
    stackMode = StackMode.absolute

    /** Whether to zoom to the selected data points */
    zoomToSelection: boolean | undefined = undefined

    /** Whether to show year labels in bar charts */
    showYearLabels: boolean | undefined = undefined

    /** Whether to show an area for entities that have no data (used in marimekko charts) */
    showNoDataArea = true

    /** Drops in between points in scatter plots */
    compareEndPointsOnly: boolean | undefined = undefined

    /** Exclude entities that do not belong in any color group */
    matchingEntitiesOnly: boolean | undefined = undefined

    /** The desired strategy for handling entities with missing data */
    missingDataStrategy: MissingDataStrategy | undefined = undefined

    /** When a user hovers over a connected series line in a ScatterPlot we show a label for each point. By default that value will be from the "year" column but by changing this option the column used for the x or y axis could be used instead. */
    scatterPointLabelStrategy: ScatterPointLabelStrategy | undefined = undefined

    /** The desired facetting strategy (none for no facetting) */
    selectedFacetStrategy: FacetStrategy | undefined = undefined

    /** Sort criterion (used by stacked bar charts and marimekko) */
    sortBy: SortBy | undefined = SortBy.total

    /** Sort order (used by stacked bar charts and marimekko) */
    sortOrder: SortOrder | undefined = SortOrder.desc

    /** Sort column if sortBy is column (used by stacked bar charts and marimekko) */
    sortColumnSlug: string | undefined = undefined

    /** List of comparison lines to draw */
    comparisonLines: ComparisonLineConfig[] | undefined = undefined

    /** Links to related questions */
    relatedQuestions: RelatedQuestionsConfig[] | undefined = undefined

    //
    // Internal state not persisted in the config
    //

    /** Optional external manager */
    private readonly manager: GrapherManager | undefined = undefined

    /** Reference to the root DOM element containing the grapher */
    base = React.createRef<HTMLDivElement>()

    /** Initial options passed when creating the GrapherState instance */
    initialOptions: GrapherProgrammaticInterface

    /** The complete data table for the chart */
    _inputTable: OwidTable = new OwidTable()

    /** Optional custom function for fetching additional data beyond the main table */
    private _additionalDataLoaderFn: AdditionalGrapherDataFetchFn | undefined =
        undefined

    /** The original config as authored, used to detect user changes from authored defaults */
    legacyConfigAsAuthored: Partial<LegacyGrapherInterface> = {}

    /** Query parameters that don't correspond to standard Grapher parameters (like tab, time, etc.) */
    externalQueryParams: QueryParams = {}

    // These are explicitly set to `false` if FetchingGrapher or some other
    // external code is fetching the config and data
    isConfigReady: boolean | undefined = true
    isDataReady: boolean | undefined = true

    // Used in explorers
    ySlugs: ColumnSlugs | undefined = undefined
    xSlug: ColumnSlug | undefined = undefined
    colorSlug: ColumnSlug | undefined = undefined
    sizeSlug: ColumnSlug | undefined = undefined
    tableSlugs: ColumnSlugs | undefined = undefined

    bakedGrapherURL: string | undefined = undefined
    adminBaseUrl: string | undefined = undefined

    isEmbeddedInAnOwidPage?: boolean = false
    isEmbeddedInADataPage?: boolean = false

    archiveContext?: ArchiveContext
    narrativeChartInfo?: MinimalNarrativeChartInfo = undefined

    analytics: GrapherAnalytics

    tooltip?: TooltipManager["tooltip"] = observable.box(undefined, {
        deep: false,
    })

    variant = GrapherVariant.Default

    /**
     * Indicates whether the chart is embedded alongside a complementary table.
     * If that's the case, the chart can be simplified (e.g. hide legends or
     * annotations) since the table serves as an additional source of information.
     */
    isDisplayedAlongsideComplementaryTable = false

    // Bounds
    staticBounds: Bounds = DEFAULT_GRAPHER_BOUNDS
    _externalBounds: Bounds | undefined = undefined

    selection: SelectionArray = new SelectionArray()
    focusArray = new FocusArray()

    dataTableConfig: DataTableConfig = { filter: "all", search: "" }

    entitySelectorState: Partial<EntitySelectorState> = {}

    /**
     * Used to highlight particular times in a line chart.
     * The sparkline in map tooltips makes use of this.
     */
    highlightedTimesInLineChart?: Time[]

    timelineController = new TimelineController(this)
    globeController = new GlobeController(this)

    /** Keeps a running cache of series colors at the Grapher level. */
    seriesColorMap: SeriesColorMap = new Map()

    isEntitySelectorModalOrDrawerOpen = false
    activeModal?: GrapherModal
    activeDownloadModalTab: DownloadModalTabName = DownloadModalTabName.Vis
    isShareMenuActive = false

    isTimelineAnimationPlaying = false
    /** True if the timeline animation is either playing or paused but not finished */
    isTimelineAnimationActive = false
    animationStartTime: Time | undefined = undefined
    areHandlesOnSameTimeBeforeAnimation: boolean | undefined = undefined
    /** Which timeline element is currently being dragged */
    timelineDragTarget: TimelineDragTarget | undefined = undefined

    // Display flags
    hasTableTab = true
    hideTitle = false
    hideSubtitle = false
    hideNote = false
    hideOriginUrl = false
    hideEntityControls = false
    hideShareButton = false
    hideExploreTheDataButton = true
    hideRelatedQuestion = false
    canHideExternalControlsInEmbed: boolean = false
    hideExternalControlsInEmbedUrl: boolean =
        this.canHideExternalControlsInEmbed
    forceHideAnnotationFieldsInTitle: AnnotationFieldsInTitle = {
        entity: false,
        time: false,
        changeInPrefix: false,
    }

    /** Whether to allow entity selection via map interactions */
    enableMapSelection = false

    isExportingToSvgOrPng = false
    isWikimediaExport = false
    shouldIncludeDetailsInStaticExport = true

    /** Base font size for responsive scaling of chart elements */
    _baseFontSize = BASE_FONT_SIZE

    _isInFullScreenMode = false
    windowInnerWidth: number | undefined = undefined
    windowInnerHeight: number | undefined = undefined

    enableKeyboardShortcuts: boolean = false
    bindUrlToWindow: boolean = false

    slideShow: SlideShowController<any> | undefined = undefined

    /** Whether the grapher is running in the editor */
    private isEditor =
        typeof window !== "undefined" && (window as any).isEditor === true

    disposers: (() => void)[] = []

    constructor(options: GrapherProgrammaticInterface) {
        makeObservable(this, {
            $schema: observable.ref,
            chartTypes: observable.ref,
            id: observable.ref,
            version: observable.ref,
            slug: observable.ref,
            title: observable.ref,
            subtitle: observable.ref,
            sourceDesc: observable.ref,
            note: observable.ref,
            internalNotes: observable.ref,
            variantName: observable.ref,
            originUrl: observable.ref,
            hideAnnotationFieldsInTitle: observable,
            minTime: observable.ref,
            maxTime: observable.ref,
            timelineMinTime: observable.ref,
            timelineMaxTime: observable.ref,
            addCountryMode: observable.ref,
            stackMode: observable.ref,
            showNoDataArea: observable.ref,
            hideLegend: observable.ref,
            logo: observable.ref,
            hideLogo: observable.ref,
            hideRelativeToggle: observable.ref,
            entityType: observable.ref,
            entityTypePlural: observable.ref,
            facettingLabelByYVariables: observable.ref,
            hideTimeline: observable.ref,
            zoomToSelection: observable.ref,
            showYearLabels: observable.ref,
            hasMapTab: observable.ref,
            tab: observable.ref,
            isPublished: observable.ref,
            baseColorScheme: observable.ref,
            invertColorScheme: observable.ref,
            hideConnectedScatterLines: observable,
            hideScatterLabels: observable.ref,
            scatterPointLabelStrategy: observable,
            compareEndPointsOnly: observable.ref,
            matchingEntitiesOnly: observable.ref,
            hideTotalValueLabel: observable.ref,
            missingDataStrategy: observable.ref,
            xAxis: observable.ref,
            yAxis: observable.ref,
            colorScale: observable,
            map: observable,
            dimensions: observable.ref,
            ySlugs: observable,
            xSlug: observable,
            colorSlug: observable,
            sizeSlug: observable,
            tableSlugs: observable,
            selectedEntityColors: observable,
            selectedEntityNames: observable,
            focusedSeriesNames: observable,
            excludedEntityNames: observable,
            includedEntityNames: observable,
            comparisonLines: observable,
            relatedQuestions: observable,
            dataTableConfig: observable,
            highlightedTimesInLineChart: observable.ref,
            hideFacetControl: observable.ref,
            selectedFacetStrategy: observable,
            sortBy: observable,
            sortOrder: observable,
            sortColumnSlug: observable,
            _isInFullScreenMode: observable.ref,
            windowInnerWidth: observable.ref,
            windowInnerHeight: observable.ref,
            bakedGrapherURL: observable,
            externalQueryParams: observable.ref,
            _inputTable: observable.ref,
            legacyConfigAsAuthored: observable.ref,
            entitySelectorState: observable,
            isConfigReady: observable,
            isDataReady: observable,
            canHideExternalControlsInEmbed: observable.ref,
            hideExternalControlsInEmbedUrl: observable.ref,
            isExportingToSvgOrPng: observable.ref,
            isWikimediaExport: observable.ref,
            variant: observable.ref,
            staticBounds: observable,
            isTimelineAnimationPlaying: observable.ref,
            isTimelineAnimationActive: observable.ref,
            animationStartTime: observable.ref,
            areHandlesOnSameTimeBeforeAnimation: observable.ref,
            timelineDragTarget: observable.ref,
            isEntitySelectorModalOrDrawerOpen: observable.ref,
            activeModal: observable.ref,
            activeDownloadModalTab: observable.ref,
            shouldIncludeDetailsInStaticExport: observable,
            _externalBounds: observable,
            slideShow: observable,
            _baseFontSize: observable,
            isShareMenuActive: observable,
            hideTitle: observable,
            hideSubtitle: observable,
            hideNote: observable,
            hideOriginUrl: observable,
            hideEntityControls: observable,
            enableMapSelection: observable,
            forceHideAnnotationFieldsInTitle: observable,
            hasTableTab: observable,
            hideShareButton: observable,
            hideExploreTheDataButton: observable,
            isDisplayedAlongsideComplementaryTable: observable,
        })

        this.updateFromObject(options)

        this._additionalDataLoaderFn = options.additionalDataLoaderFn
        this.isEmbeddedInAnOwidPage = options.isEmbeddedInAnOwidPage ?? false
        this.isEmbeddedInADataPage = options.isEmbeddedInADataPage ?? false

        this._inputTable =
            options.table ?? BlankOwidTable(`initialGrapherTable`)
        this.initialOptions = options
        this.analytics = new GrapherAnalytics(this.initialOptions.env ?? "")
        this.selection =
            this.manager?.selection ??
            new SelectionArray(this.initialOptions.selectedEntityNames ?? [])
        this.setAuthoredVersion(options)
        this.canHideExternalControlsInEmbed =
            options.canHideExternalControlsInEmbed ?? false
        this.staticBounds = options.staticBounds ?? DEFAULT_GRAPHER_BOUNDS

        this.narrativeChartInfo = options.narrativeChartInfo
        this.archiveContext = options.archiveContext

        this.populateFromQueryParams(
            legacyToCurrentGrapherQueryParams(
                this.initialOptions.queryStr ?? ""
            )
        )
        if (this.isEditor) {
            this.ensureValidConfigWhenEditing()
        }
    }

    @action.bound updateFromObject(obj?: GrapherProgrammaticInterface): void {
        if (!obj) return

        updatePersistables(this, obj)

        this.bindUrlToWindow = obj.bindUrlToWindow ?? false

        // Update selection
        if (obj.selectedEntityNames)
            this.selection.setSelectedEntities(obj.selectedEntityNames)

        // Update focus
        if (obj.focusedSeriesNames)
            this.focusArray.clearAllAndAdd(...obj.focusedSeriesNames)

        // JSON doesn't support Infinity, so we use strings instead.
        this.minTime = minTimeBoundFromJSONOrNegativeInfinity(obj.minTime)
        this.maxTime = maxTimeBoundFromJSONOrPositiveInfinity(obj.maxTime)

        this.timelineMinTime = minTimeBoundFromJSONOrNegativeInfinity(
            obj.timelineMinTime
        )
        this.timelineMaxTime = maxTimeBoundFromJSONOrPositiveInfinity(
            obj.timelineMaxTime
        )

        if (obj?.dimensions?.length)
            this.setDimensionsFromConfigs(obj.dimensions)
    }

    toObject(): GrapherInterface {
        const obj: GrapherInterface = objectWithPersistablesToObject(
            this,
            grapherKeysToSerialize
        )

        // Persist selection and focus
        obj.selectedEntityNames = this.selection.selectedEntityNames
        obj.focusedSeriesNames = this.focusArray.seriesNames

        deleteRuntimeAndUnchangedProps(obj, defaultObject)

        // Always include the schema, even if it's the default
        obj.$schema = this.$schema || latestGrapherConfigSchema

        // JSON doesn't support Infinity, so we use strings instead
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        if (obj.timelineMinTime)
            obj.timelineMinTime = minTimeToJSON(this.timelineMinTime) as any
        if (obj.timelineMaxTime)
            obj.timelineMaxTime = maxTimeToJSON(this.timelineMaxTime) as any

        // Don't serialize the tab if the default chart is currently shown
        if (
            this.activeChartType &&
            this.activeChartType === this.defaultChartType
        ) {
            delete obj.tab
        }

        // Explorers set color properties directly on column defs.
        // These properties wouldn't be serialized in the JSON config by default,
        // so this code extracts them and adds them to the serialized object.
        // Color properties from the color column are stored as obj.colorScale
        if (this.colorColumnSlug && !obj.colorScale) {
            const colorColumn = this.inputTable.get(this.colorColumnSlug)
            const colorScaleConfig = ColorScaleConfig.fromDSL(colorColumn.def)
            if (colorScaleConfig) obj.colorScale = colorScaleConfig.toObject()
        }

        // Similarly, color properties from the map column are stored as obj.map.colorScale
        if (this.hasMapTab && this.mapColumnSlug && !obj.map?.colorScale) {
            const mapColumn = this.inputTable.get(this.mapColumnSlug)
            const colorScaleConfig = ColorScaleConfig.fromDSL(mapColumn.def)
            if (colorScaleConfig) {
                obj.map ??= {}
                obj.map.colorScale = colorScaleConfig.toObject()
            }
        }

        return obj
    }

    /** Returns an object ready to be serialized to JSON */
    @computed get object(): GrapherInterface {
        return this.toObject()
    }

    /**
     * The complete, unfiltered data table for the chart.
     *
     * This is the raw input data provided to the Grapher. This table is the
     * starting point for all data transformations in the pipeline. It contains
     * all entities and all time periods present in the data before any filtering
     * or chart-specific transforms are applied.
     */
    get inputTable(): OwidTable {
        return this._inputTable
    }

    @action set inputTable(table: OwidTable) {
        this._inputTable = table

        if (this.manager?.selection?.hasSelection) {
            // Selection is managed externally, do nothing
        } else if (this.areSelectedEntitiesDifferentThanAuthors) {
            // User has changed the selection, use theirs
        } else this.applyOriginalSelectionAsAuthored()
    }

    /**
     * Input table with color and size tolerance applied.
     *
     * This happens _before_ applying the author's timeline filter to avoid
     * accidentally dropping all color values before applying tolerance.
     * This is especially important for scatter plots and Marimekko charts,
     * where color and size columns are often transformed with infinite tolerance.
     *
     * Line and discrete bar charts also support a color dimension, but their
     * tolerance transformations run in their respective transformTable functions
     * since it's more efficient to run them on a table that has been filtered
     * by selected entities.
     */
    @computed get tableAfterColorAndSizeToleranceApplication(): OwidTable {
        let table = this.inputTable

        if (this.hasScatter && this.sizeColumnSlug) {
            const tolerance =
                table.get(this.sizeColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(this.sizeColumnSlug, {
                toleranceOverride: tolerance,
            })
        }

        if (
            (this.hasScatter || this.hasMarimekko) &&
            this.categoricalColorColumnSlug
        ) {
            const tolerance =
                table.get(this.categoricalColorColumnSlug)?.display
                    ?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.categoricalColorColumnSlug,
                { toleranceOverride: tolerance }
            )
        }

        return table
    }

    /**
     * Table after author-specified entity and timeline filters have been applied.
     *
     * This is the earliest filtering step in the pipeline. The author can configure
     * entity include/exclude patterns (includedEntityNames, excludedEntityNames) and
     * timeline bounds (timelineMinTime, timelineMaxTime). These filters are applied
     * before any chart-specific transforms, so to the charts it appears as if the
     * filtered times and entities do not exist in the data.
     */
    @computed get tableAfterAuthorTimelineAndEntityFilter(): OwidTable {
        let table = this.tableAfterColorAndSizeToleranceApplication

        // Filter entities
        table = table.filterByEntityNamesUsingIncludeExcludePattern({
            excluded: this.excludedEntityNames,
            included: this.includedEntityNames,
        })

        // Filter times
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

    /** The base data table after author-configured filters have been applied */
    @computed get table(): OwidTable {
        return this.tableAfterAuthorTimelineAndEntityFilter
    }

    /**
     * Table after the active chart type's transformation has been applied.
     *
     * Different chart types (line, bar, scatter, etc.) have different data requirements
     * and transformations. This property applies the chart-specific transformTable()
     * method to prepare the data for that chart type's rendering. This happens before
     * any user-selected time range filtering (startTime/endTime).
     */
    @computed get tableAfterAuthorTimelineAndActiveChartTransform(): OwidTable {
        const table = this.table
        if (!this.isReady || !this.isOnChartOrMapTab) return table

        const startMark = performance.now()

        const transformedTable = this.chartState.transformTable(table)

        this.createPerformanceMeasurement(
            "chartInstance.transformTable",
            startMark
        )
        return transformedTable
    }

    /**
     * Table after all chart transforms and user-selected time range filtering.
     *
     * This applies the final filtering step based on the currently selected time range
     * (startTime and endTime).
     */
    @computed
    private get tableAfterAllTransformsAndFilters(): OwidTable {
        const { startTime, endTime } = this
        const table = this.tableAfterAuthorTimelineAndActiveChartTransform

        if (startTime === undefined || endTime === undefined) return table

        if (this.isOnMapTab) {
            const targetTimes = this.isFaceted
                ? [startTime, endTime]
                : [endTime]

            return table.filterByTargetTimes(targetTimes)
        }

        if (this.isOnDiscreteBarTab || this.isOnMarimekkoTab)
            return table.filterByTargetTimes([endTime])

        if (this.isOnSlopeChartTab)
            return table.filterByTargetTimes([startTime, endTime])

        return table.filterByTimeRange(startTime, endTime)
    }

    /** The final transformed table ready for chart rendering */
    @computed get transformedTable(): OwidTable {
        return this.tableAfterAllTransformsAndFilters
    }

    /** Table used to determine which entities can be selected in the entity selector */
    @computed get tableForSelection(): OwidTable {
        // Depending on the chart type, the criteria for being able to select an entity are
        // different; e.g. for scatterplots, the entity needs to (1) not be excluded and
        // (2) needs to have data for the x and y dimension.
        let table =
            this.isOnScatterTab || this.isOnMarimekkoTab
                ? this.tableAfterAuthorTimelineAndActiveChartTransform
                : this.table

        if (!this.isReady) return table

        // Some chart types (e.g. stacked area charts) choose not to show an entity
        // with incomplete data. Such chart types define a custom transform function
        // to ensure that the entity selector only offers entities that are actually plotted.
        if (this.chartState.transformTableForSelection) {
            table = this.chartState.transformTableForSelection(table)
        }

        return table
    }

    /** Base table for the data table tab */
    @computed get tableForDisplayBeforeEntityFilter(): OwidTable {
        let table = this.table

        if (!this.isReady || !this.isOnTableTab) return table

        if (this.chartState.transformTableForDisplay) {
            table = this.chartState.transformTableForDisplay(table)
        }

        if (this.shouldShowSelectionOnlyInDataTable) {
            table = table.filterByEntityNames(
                this.selection.selectedEntityNames
            )
        }

        return table
    }

    /** Table for display in the data table tab */
    @computed get tableForDisplay(): OwidTable {
        let table = this.tableForDisplayBeforeEntityFilter
        const { filter } = this.dataTableConfig

        const availableEntities = table.availableEntityNames

        // Determine which entities should be visible based on the filter
        const visibleEntities = match(filter)
            .with("all", () => availableEntities)
            .with("selection", () =>
                this.selection.hasSelection
                    ? this.selection.selectedEntityNames
                    : availableEntities
            )
            .when(isEntityRegionType, (filter) => {
                const regionNames = this.entityNamesByRegionType.get(filter)
                return regionNames ?? availableEntities
            })
            .exhaustive()

        // Apply entity filter if necessary
        if (visibleEntities.length < availableEntities.length)
            table = table.filterByEntityNames(visibleEntities)

        return table
    }

    @action.bound populateFromQueryParams(params: GrapherQueryParams): void {
        this.externalQueryParams = _.omit(params, GRAPHER_QUERY_PARAM_KEYS)

        // Set tab if specified
        const parsedTab = params.tab
            ? this.mapQueryParamToTabName(params.tab)
            : undefined
        if (parsedTab) this.setTab(parsedTab)
        else if (params.tab !== undefined)
            console.error("Unexpected tab: " + params.tab)

        // Set overlay if specified
        const overlay = params.overlay
        if (overlay) {
            if (overlay === "sources") {
                this.activeModal = GrapherModal.Sources
            } else if (overlay === "download-data") {
                this.activeModal = GrapherModal.Download
                this.activeDownloadModalTab = DownloadModalTabName.Data
            } else if (overlay === "download-vis") {
                this.activeModal = GrapherModal.Download
                this.activeDownloadModalTab = DownloadModalTabName.Vis
            } else if (overlay === "download") {
                this.activeModal = GrapherModal.Download
            } else if (overlay === "embed") {
                // We could include the embed modal in the `overlay=` params,
                // but there has been an issue in the past where we accidentally
                // included that in the Embed dialog's URL, and then embeds would
                // always show the modal.
                // So, if it is specified in the query params, we just ignore it.
                // Linking directly to the modal doesn't have much of a use case, anyway.
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

        // Globe
        const globe = params.globe
        if (globe !== undefined) {
            this.mapConfig.globe.isActive = globe === "1"
        }

        // Globe rotation
        const globeRotation = params.globeRotation
        if (globeRotation !== undefined) {
            this.mapConfig.globe.rotation = parseGlobeRotation(globeRotation)
        }

        // Globe zoom
        const globeZoom = params.globeZoom
        if (globeZoom !== undefined) {
            const parsedZoom = parseFloatOrUndefined(globeZoom)
            if (parsedZoom !== undefined) this.mapConfig.globe.zoom = parsedZoom
        }

        // Region
        const region = params.region
        if (region !== undefined && isValidMapRegionName(region)) {
            this.map.region = region
        }

        // Map selection
        const mapSelection = getEntityNamesParam(params.mapSelect)
        if (mapSelection) {
            this.mapConfig.selection.setSelectedEntities(mapSelection)
        }

        // Selection
        const url = Url.fromQueryParams(params)
        const selection = getSelectedEntityNamesParam(url)
        if (this.addCountryMode !== EntitySelectionMode.Disabled && selection)
            this.selection.setSelectedEntities(selection)

        // Focus
        const focusedSeriesNames = getFocusedSeriesNamesParam(params.focus)
        if (focusedSeriesNames) {
            this.focusArray.clearAllAndAdd(...focusedSeriesNames)
        }

        // Faceting
        if (params.facet && params.facet in FacetStrategy) {
            this.selectedFacetStrategy = params.facet as FacetStrategy
        }
        if (params.uniformYAxis === "0") {
            this.yAxis.facetDomain = FacetAxisDomain.independent
        } else if (params.uniformYAxis === "1") {
            this.yAxis.facetDomain = FacetAxisDomain.shared
        }

        // No data area in marimekko charts
        if (params.showNoDataArea) {
            this.showNoDataArea = params.showNoDataArea === "1"
        }

        // Deprecated; support for legacy URLs
        if (params.showSelectionOnlyInTable) {
            this.dataTableConfig.filter =
                params.showSelectionOnlyInTable === "1" ? "selection" : "all"
        }

        // Data table filter
        if (params.tableFilter) {
            this.dataTableConfig.filter = isValidDataTableFilter(
                params.tableFilter
            )
                ? params.tableFilter
                : "all"
        }

        // Data table search
        if (params.tableSearch) {
            this.dataTableConfig.search = params.tableSearch
        }
    }

    @action.bound setTimeFromTimeQueryParam(time: string): void {
        this.timelineHandleTimeBounds = getTimeDomainFromQueryString(time).map(
            (time) => findClosestTime(this.times, time) ?? time
        ) as TimeBounds
    }

    @computed private get isDev(): boolean {
        return this.initialOptions.env === "dev"
    }

    @computed get dataTableSlugs(): ColumnSlug[] {
        return this.tableSlugs ? this.tableSlugs.split(" ") : this.newSlugs
    }

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

    @computed get activeTab(): GrapherTabName {
        return this.mapTabConfigOptionToTabName(this.tab)
    }

    @computed get activeChartType(): GrapherChartType | undefined {
        return isChartTypeName(this.activeTab) ? this.activeTab : undefined
    }

    @computed private get defaultChartType(): GrapherChartType {
        return this.chartType ?? GRAPHER_CHART_TYPES.LineChart
    }

    @computed private get defaultTab(): GrapherTabName {
        if (this.chartType) return this.chartType
        if (this.hasMapTab) return GRAPHER_TAB_NAMES.WorldMap
        return GRAPHER_TAB_NAMES.Table
    }

    @computed get chartType(): GrapherChartType | undefined {
        return this.validChartTypes[0]
    }

    @computed get hasChartTab(): boolean {
        return this.validChartTypes.length > 0
    }

    @computed get isOnChartTab(): boolean {
        return !this.isOnMapTab && !this.isOnTableTab
    }

    @computed get isOnMapTab(): boolean {
        return this.activeTab === GRAPHER_TAB_NAMES.WorldMap
    }

    @computed get isOnTableTab(): boolean {
        return this.activeTab === GRAPHER_TAB_NAMES.Table
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

    @computed get showLegend(): boolean {
        // Hide the legend for stacked bar charts if the legend only ever shows a single entity
        if (this.isOnStackedBarTab) {
            const seriesStrategy =
                this.chartState.seriesStrategy ||
                autoDetectSeriesStrategy(this, true)
            const isEntityStrategy = seriesStrategy === SeriesStrategy.entity
            const hasSingleEntity = this.selection.numSelectedEntities === 1
            const hideLegend =
                this.hideLegend || (isEntityStrategy && hasSingleEntity)
            return !hideLegend
        }

        return !this.hideLegend
    }

    private isChartTypeThatShowsAllEntities(
        chartType: GrapherChartType
    ): boolean {
        return CHART_TYPES_THAT_SHOW_ALL_ENTITIES.includes(chartType)
    }

    @computed private get hasChartThatShowsAllEntities(): boolean {
        return this.validChartTypes.some((chartType) =>
            this.isChartTypeThatShowsAllEntities(chartType)
        )
    }

    @computed get isOnArchivalPage(): boolean {
        return this.archiveContext?.type === "archive-page"
    }

    @computed get hasArchivedPage(): boolean {
        return this.archiveContext?.type === "archived-page-version"
    }

    @computed get additionalDataLoaderFn():
        | AdditionalGrapherDataFetchFn
        | undefined {
        if (this.isOnArchivalPage) return undefined
        return this._additionalDataLoaderFn
    }

    /**
     * We only show the selected entities in the data table if entity selection
     * is disabled – unless there is a view that displays all data points, like
     * a map or a scatter plot.
     */
    @computed get shouldShowSelectionOnlyInDataTable(): boolean {
        return (
            this.selection.hasSelection &&
            !this.canChangeAddOrHighlightEntities &&
            this.hasChartTab &&
            !this.hasChartThatShowsAllEntities &&
            !this.hasMapTab
        )
    }

    /**
     * Selection used in Grapher's data table.
     *
     * If a map selection is set, it is preferred over the chart selection.
     */
    @computed get dataTableSelection(): SelectionArray {
        return this.mapConfig.selection.hasSelection
            ? this.mapConfig.selection
            : this.selection
    }

    @computed get chartState(): ChartState {
        return this.isOnMapTab
            ? makeChartState(GRAPHER_MAP_TYPE, this)
            : this.chartStateExceptMap
    }

    @computed get facetChartInstance(): FacetChart | undefined {
        if (!this.isFaceted) return undefined
        return new FacetChart({
            manager: this,
            chartTypeName: this.activeChartType,
        })
    }

    @computed get chartStateExceptMap(): ChartState {
        const chartType = this.activeChartType ?? GRAPHER_CHART_TYPES.LineChart

        return makeChartState(chartType, this)
    }

    @computed get chartSeriesNames(): SeriesName[] {
        if (!this.isReady) return []

        // Collect series names from all chart instances when faceted
        if (this.isFaceted) {
            return _.uniq(
                this.facetChartInstance?.intermediateChartInstances.flatMap(
                    (chartInstance) =>
                        chartInstance.chartState.series.map(
                            (series) => series.seriesName
                        )
                ) ?? []
            )
        }

        return this.chartState.series.map((series) => series.seriesName)
    }

    @computed get isStatic(): boolean {
        return this.isExportingToSvgOrPng
    }

    private get isStaging(): boolean {
        if (typeof location === "undefined") return false
        return location.host.includes("staging")
    }

    private get isLocalhost(): boolean {
        if (typeof location === "undefined") return false
        return location.host.includes("localhost")
    }

    @computed get editUrl(): string | undefined {
        let editPath = this.manager?.adminEditPath
        if (!editPath && this.id) {
            editPath = `charts/${this.id}/edit`
        }
        if (this.showAdminControls && this.adminBaseUrl && editPath) {
            return `${this.adminBaseUrl}/admin/${editPath}`
        }
        return undefined
    }

    @computed get createNarrativeChartUrl(): string | undefined {
        const adminPath = this.manager?.adminCreateNarrativeChartPath
        if (this.showAdminControls && this.isPublished && adminPath) {
            return `${this.adminBaseUrl}/admin/${adminPath}`
        }
        return undefined
    }

    @computed private get isAdminObjectAvailable(): boolean {
        if (typeof window === "undefined") return false
        return (
            window.admin !== undefined &&
            // Ensure that we're not accidentally matching on a DOM element with an ID of "admin"
            typeof window.admin.isSuperuser === "boolean"
        )
    }

    @computed get isAdmin(): boolean {
        if (typeof window === "undefined") return false
        if (this.isAdminObjectAvailable) return true
        // Using this.isAdminObjectAvailable is not enough because it's not
        // available in gdoc previews, which render in an iframe without the
        // admin scaffolding.
        if (this.adminBaseUrl) {
            try {
                const adminUrl = new URL(this.adminBaseUrl)
                const currentUrl = new URL(window.location.href)
                return adminUrl.host === currentUrl.host
            } catch {
                return false
            }
        }
        return false
    }

    @computed private get isUserLoggedInAsAdmin(): boolean {
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

    @computed get showAdminControls(): boolean {
        return (
            this.isUserLoggedInAsAdmin ||
            this.isAdmin || // Useful for gdoc previews.
            this.isDev ||
            this.isLocalhost ||
            this.isStaging
        )
    }

    // Exclusively used for the performance.measurement API, so that DevTools can show some context
    createPerformanceMeasurement(name: string, startMark: number): void {
        const endMark = performance.now()
        const detail = {
            devtools: {
                track: "Grapher",
                properties: [
                    // might be missing for charts within explorers or mdims
                    ["slug", this.slug ?? "missing-slug"],
                    ["chartTypes", this.validChartTypes],
                    ["tab", this.tab],
                ],
            },
        }

        try {
            performance.measure(name, {
                start: startMark,
                end: endMark,
                detail,
            })
        } catch {
            // In old browsers, the above may throw an error - just ignore it
        }
    }

    @action.bound private applyOriginalFocusAsAuthored(): void {
        if (this.focusedSeriesNames?.length)
            this.focusArray.clearAllAndAdd(...this.focusedSeriesNames)
    }

    @action.bound private applyOriginalSelectionAsAuthored(): void {
        if (this.selectedEntityNames?.length)
            this.selection.setSelectedEntities(this.selectedEntityNames)
    }

    @computed get hasData(): boolean {
        return this.dimensions.length > 0 || this.newSlugs.length > 0
    }

    /**
     * Ready to go if we have retrieved data for every variable associated
     * with the chart or the config and data are marked as ready
     */
    @computed get isReady(): boolean {
        if (!this.isConfigReady) return false
        if (!this.isDataReady) return false
        return this.whatAreWeWaitingFor === ""
    }

    @computed get whatAreWeWaitingFor(): string {
        const { newSlugs, inputTable, dimensions } = this
        if (newSlugs.length || dimensions.length === 0) {
            const missingColumns = newSlugs.filter(
                (slug) => !inputTable.has(slug)
            )
            return missingColumns.length
                ? `Waiting for columns ${missingColumns.join(",")} in table '${inputTable.tableSlug}'. ${inputTable.tableDescription}`
                : ""
        }
        if (dimensions.length > 0 && this.loadingDimensions.length === 0)
            return ""
        return `Waiting for dimensions ${this.loadingDimensions.join(",")}.`
    }

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
        const { mapColumnSlug, projectionColumnInfoBySlug, yColumnSlugs } = this

        // If the map shows historical and projected data, then the time range
        // has to extend to the full range of both indicators
        const mapColumnInfo = projectionColumnInfoBySlug.get(mapColumnSlug)
        const mapColumnSlugs = mapColumnInfo
            ? [mapColumnInfo.projectedSlug, mapColumnInfo.historicalSlug]
            : [mapColumnSlug]

        const columnSlugs = this.isOnMapTab ? mapColumnSlugs : yColumnSlugs

        // Generate the times only after the chart transform has been applied, so that we don't show
        // times on the timeline for which data may not exist, e.g. when the selected entity
        // doesn't contain data for all years in the table.
        // -@danielgavrilov, 2020-10-22
        return this.tableAfterAuthorTimelineAndActiveChartTransform.getTimesUniqSortedAscForColumns(
            columnSlugs
        )
    }

    /**
     * Plots time on the x-axis.
     */
    @computed private get hasTimeDimension(): boolean {
        return this.isStackedBar || this.isStackedArea || this.isLineChart
    }

    @computed private get hasTimeDimensionButTimelineIsHidden(): boolean {
        return this.hasTimeDimension && !!this.hideTimeline
    }

    @computed get startHandleTimeBound(): TimeBound {
        if (this.isSingleTimeSelectionActive) return this.endHandleTimeBound
        return this.timelineHandleTimeBounds[0]
    }

    private set startHandleTimeBound(newValue: TimeBound) {
        if (this.isSingleTimeSelectionActive)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                newValue,
                this.timelineHandleTimeBounds[1],
            ]
    }

    private set endHandleTimeBound(newValue: TimeBound) {
        if (this.isSingleTimeSelectionActive)
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

    @computed get closestTimelineMinTime(): Time | undefined {
        return findClosestTime(this.times, this.timelineMinTime ?? -Infinity)
    }

    @computed get closestTimelineMaxTime(): Time | undefined {
        return findClosestTime(this.times, this.timelineMaxTime ?? Infinity)
    }

    @computed get startTime(): Time | undefined {
        return findClosestTime(this.times, this.startHandleTimeBound)
    }

    @computed get endTime(): Time | undefined {
        return findClosestTime(this.times, this.endHandleTimeBound)
    }

    @computed get isSingleTimeScatterAnimationActive(): boolean {
        return (
            this.isTimelineAnimationActive &&
            this.isOnScatterTab &&
            !this.isRelativeMode &&
            !!this.areHandlesOnSameTimeBeforeAnimation
        )
    }

    @computed private get isSingleTimeMapAnimationActive(): boolean {
        return (
            this.isTimelineAnimationActive &&
            this.isOnMapTab &&
            !!this.areHandlesOnSameTimeBeforeAnimation
        )
    }

    @computed private get onlySingleTimeSelectionPossible(): boolean {
        return this.checkOnlySingleTimeSelectionPossible(this.activeTab)
    }

    @computed get onlyTimeRangeSelectionPossible(): boolean {
        return this.checkOnlyTimeRangeSelectionPossible(this.activeTab)
    }

    @computed get isSingleTimeSelectionActive(): boolean {
        return (
            this.onlySingleTimeSelectionPossible ||
            this.isSingleTimeScatterAnimationActive ||
            this.isSingleTimeMapAnimationActive
        )
    }

    @computed get shouldLinkToOwid(): boolean {
        if (
            this.isEmbeddedInAnOwidPage ||
            this.isExportingToSvgOrPng ||
            !this.isInIFrame
        )
            return false

        return true
    }

    @computed get hasOWIDLogo(): boolean {
        return (
            !this.hideLogo && (this.logo === undefined || this.logo === "owid")
        )
    }

    @computed get hasFatalErrors(): boolean {
        const { relatedQuestions = [] } = this
        return relatedQuestions.some(
            (question) => !!getErrorMessageRelatedQuestionUrl(question)
        )
    }

    @action.bound setTab(newTab: GrapherTabName): void {
        this.tab = this.mapTabNameToTabConfigOption(newTab)
    }

    @action.bound private ensureHandlesAreOnSameTime(): void {
        if (this.areHandlesOnSameTime) return

        this.timelineHandleTimeBounds = [
            this.endHandleTimeBound,
            this.endHandleTimeBound,
        ]
    }

    @action.bound private ensureHandlesAreOnDifferentTimes(): void {
        if (!this.areHandlesOnSameTime) return

        const time = this.startTime // startTime = endTime
        if (time === this.closestTimelineMinTime) {
            this.timelineHandleTimeBounds = [time ?? -Infinity, Infinity]
        } else {
            this.timelineHandleTimeBounds = [-Infinity, time ?? Infinity]
        }
    }

    @computed get entitySelector(): EntitySelector {
        const entitySelectorArray = this.isOnMapTab
            ? this.mapConfig.selection
            : this.selection
        return new EntitySelector({
            manager: this,
            selection: entitySelectorArray,
        })
    }

    private checkOnlySingleTimeSelectionPossible = (
        tabName: GrapherTabName
    ): boolean => {
        // Scatters aren't included here because although single-time selection
        // is preferred, start and end time selection is still possible
        return [
            GRAPHER_TAB_NAMES.DiscreteBar,
            GRAPHER_TAB_NAMES.StackedDiscreteBar,
            GRAPHER_TAB_NAMES.Marimekko,
        ].includes(tabName as any)
    }

    private checkOnlyTimeRangeSelectionPossible = (
        tabName: GrapherTabName
    ): boolean => {
        return [
            GRAPHER_TAB_NAMES.LineChart,
            GRAPHER_TAB_NAMES.SlopeChart,
            GRAPHER_TAB_NAMES.StackedArea,
            GRAPHER_TAB_NAMES.StackedBar,
        ].includes(tabName as any)
    }

    @action.bound ensureTimeHandlesAreSensibleForTab(
        tab: GrapherTabName
    ): void {
        if (this.checkOnlySingleTimeSelectionPossible(tab)) {
            this.ensureHandlesAreOnSameTime()
        } else if (this.checkOnlyTimeRangeSelectionPossible(tab)) {
            this.ensureHandlesAreOnDifferentTimes()
        }
    }

    @action.bound private ensureEntitySelectionIsSensibleForTab(
        tab: GrapherTabName
    ): void {
        // No-op if the current tab is a map or table tab
        if (!isChartTab(tab)) return

        const isChartTypeThatShowsAllEntities =
            this.isChartTypeThatShowsAllEntities(tab)

        // If the chart show all entities (e.g. scatter plot or Marimekko chart),
        // then we typically prefer no selection unless the user has explicitly
        // made changes to the default selection
        if (
            isChartTypeThatShowsAllEntities &&
            !this.areSelectedEntitiesDifferentThanAuthors
        ) {
            this.selection.clearSelection()
        }

        // If the chart type only shows a subset of entities at a time
        // (e.g. line chart), then an empty selection is not useful, so we
        // automatically apply the author's selection
        if (!isChartTypeThatShowsAllEntities && !this.selection.hasSelection) {
            this.applyOriginalSelectionAsAuthored()
        }
    }

    @action.bound onChartSwitching(
        _oldTab: GrapherTabName,
        newTab: GrapherTabName
    ): void {
        if (!this.isReady)
            console.warn(
                "onChartSwitching has been called before grapher has loaded its data, this is probably a mistake"
            )

        this.ensureTimeHandlesAreSensibleForTab(newTab)
        this.ensureEntitySelectionIsSensibleForTab(newTab)

        // Stop animation when switching to a tab where playback is disabled
        if (this.disablePlay && this.isTimelineAnimationActive) {
            this.timelineController.stop()
        }
    }

    @action.bound syncEntitySelectionBetweenChartAndMap(
        oldTab: GrapherTabName,
        newTab: GrapherTabName
    ): void {
        // Sync entity selection between the map and the chart tab if entity
        // selection is enabled for the map, and the map has been interacted
        // with, i.e. at least one country has been selected on the map
        const shouldSyncSelection =
            this.addCountryMode !== EntitySelectionMode.Disabled &&
            this.isMapSelectionEnabled &&
            this.mapConfig.selection.hasSelection

        // Switching from the chart tab to the map tab
        if (!isMapTab(oldTab) && isMapTab(newTab) && shouldSyncSelection) {
            this.mapConfig.selection.setSelectedEntities(
                this.selection.selectedEntityNames
            )
        }

        // Switching from the map tab to the chart tab
        if (isMapTab(oldTab) && !isMapTab(newTab) && shouldSyncSelection) {
            this.selection.setSelectedEntities(
                this.mapConfig.selection.selectedEntityNames
            )
        }
    }

    @action.bound private validateEntitySelectorState(
        newTab: GrapherTabName
    ): void {
        if (isMapTab(newTab) || isChartTab(newTab)) {
            const { entitySelector } = this

            // The map and chart tab might have a different set of sort columns;
            // if the currently selected sort column is invalid, reset it to the default
            const sortSlug = entitySelector.sortConfig.slug
            if (!entitySelector.isSortSlugValid(sortSlug)) {
                this.entitySelectorState.sortConfig =
                    entitySelector.getDefaultSortConfig()
            }

            // The map and chart tab might have a different set of entity filters;
            // if the currently selected entity filter is invalid, reset it
            const { entityFilter } = this.entitySelectorState
            if (entityFilter) {
                if (!this.entitySelector.isEntityFilterValid(entityFilter)) {
                    this.entitySelectorState.entityFilter = undefined
                }
            }

            // The map column slug might be interpolated with different
            // tolerance values on the chart and the map tab
            entitySelector.resetInterpolatedMapColumn()
        }
    }

    @action.bound onTabChange(
        oldTab: GrapherTabName,
        newTab: GrapherTabName
    ): void {
        this.onChartSwitching(oldTab, newTab)
        this.syncEntitySelectionBetweenChartAndMap(oldTab, newTab)
        this.validateEntitySelectorState(newTab)
    }

    @action.bound private ensureValidConfigWhenEditing(): void {
        const disposers = [
            autorun(() => {
                if (!this.availableTabs.includes(this.activeTab))
                    runInAction(() => this.setTab(this.availableTabs[0]))
            }),
            autorun(() => {
                const validDimensions = this.validDimensions
                if (!_.isEqual(this.dimensions, validDimensions))
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
                validDimensions = _.uniqWith(
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

    @computed get originUrlWithProtocol(): string {
        if (!this.originUrl) return ""
        let url = this.originUrl

        // If the URL is relative, make it absolute to ourworldindata.org.
        // we could also opt to make it relative to bakedGrapherUrl, but then we'd
        // end up with different URLs than prod on staging servers and in the SVG tester,
        // which could also affect positioning.
        if (url.startsWith("/")) {
            url = new URL(url, GRAPHER_PROD_URL).href
        }
        if (!url.startsWith("http")) url = `https://${url}`
        return url
    }

    @computed get timelineHandleTimeBounds(): TimeBounds {
        if (this.isOnMapTab) {
            const endTime = maxTimeBoundFromJSONOrPositiveInfinity(
                this.map.time
            )

            // If a start time is provided, use it; otherwise, set it to the end time
            // so that a single map (not a faceted one) is shown by default
            const startTime =
                this.map.startTime === undefined
                    ? endTime
                    : minTimeBoundFromJSONOrNegativeInfinity(this.map.startTime)

            return [startTime, endTime]
        }

        // If the timeline is hidden on the chart tab but displayed on the table tab
        // (which is the case for charts that plot time on the x-axis),
        // we always want to use the authored `minTime` and `maxTime` for the chart,
        // irrespective of the time range the user might have selected on the table tab
        if (this.isOnChartTab && this.hasTimeDimensionButTimelineIsHidden) {
            const { minTime, maxTime } = this.authorsVersion
            return [
                minTimeBoundFromJSONOrNegativeInfinity(minTime),
                maxTimeBoundFromJSONOrPositiveInfinity(maxTime),
            ]
        }

        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeBoundFromJSONOrNegativeInfinity(this.minTime),
            maxTimeBoundFromJSONOrPositiveInfinity(this.maxTime),
        ]
    }

    set timelineHandleTimeBounds(value: TimeBounds) {
        if (this.isOnMapTab) {
            this.map.startTime = value[0]
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

        if (this.hasScatter) return [yAxis, xAxis, size, color]
        if (this.hasMarimekko) return [yAxis, xAxis, color]
        if (this.hasLineChart || this.hasDiscreteBar) return [yAxis, color]
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

    @computed get defaultSlug(): string {
        return slugify(this.displayTitle)
    }

    @computed get displaySlug(): string {
        return this.slug ?? this.defaultSlug
    }

    // Used for superscript numbers in static exports
    @computed get detailsOrderedByReference(): string[] {
        if (typeof window === "undefined") return []

        // Extract details from supporting text
        const subtitleDetails = !this.hideSubtitle
            ? extractDetailsFromSyntax(this.currentSubtitle)
            : []
        const noteDetails = !this.hideNote
            ? extractDetailsFromSyntax(this.note ?? "")
            : []

        // Extract details from axis labels
        const yAxisDetails = extractDetailsFromSyntax(
            this.yAxisConfig.label || ""
        )
        const xAxisDetails = extractDetailsFromSyntax(
            this.xAxisConfig.label || ""
        )

        // Text fragments are ordered by appearance
        const uniqueDetails = _.uniq([
            ...subtitleDetails,
            ...yAxisDetails,
            ...xAxisDetails,
            ...noteDetails,
        ])

        return uniqueDetails
    }

    @computed get detailsMarkerInSvg(): DetailsMarker {
        const { isStatic, shouldIncludeDetailsInStaticExport } = this
        return !isStatic
            ? "underline"
            : shouldIncludeDetailsInStaticExport
              ? "superscript"
              : "none"
    }

    // Used for static exports
    @computed get detailRenderers(): MarkdownTextWrap[] {
        if (typeof window === "undefined") return []
        return this.detailsOrderedByReference.map((term, i) => {
            let text = `**${i + 1}.** `
            const detail: EnrichedDetail | undefined = window.details?.[term]
            if (detail && detail.text) {
                const lines = detail.text.split("\n")
                const title = lines[0]
                const description = lines.slice(2).join("\n")
                text += `**${title}** ${description}`
            }

            // We can't use the computed property here because Grapher might
            // not currently be in static mode
            const baseFontSize = this.areStaticBoundsSmall
                ? this.computeBaseFontSizeFromHeight(this.staticBounds)
                : 18

            return new MarkdownTextWrap({
                text,
                fontSize: (11 / BASE_FONT_SIZE) * baseFontSize,
                // Leave room for padding on the left and right
                maxWidth:
                    this.staticBounds.width -
                    2 * GRAPHER_FRAME_PADDING_HORIZONTAL,
                lineHeight: 1.2,
                style: { fill: GRAPHER_LIGHT_TEXT },
            })
        })
    }

    @computed get hasProjectedData(): boolean {
        return this.inputTable.numericColumnSlugs.some(
            (slug) => this.inputTable.get(slug).isProjection
        )
    }

    @computed get projectionColumnInfoBySlug(): Map<
        ColumnSlug,
        ProjectionColumnInfo
    > {
        const table = this.inputTable

        const [projectionSlugs, nonProjectionSlugs] = R.partition(
            this.yColumnSlugs,
            (slug) => table.get(slug).isProjection
        )

        if (!projectionSlugs.length) return new Map()

        const projectionColumnInfoBySlug = new Map<
            ColumnSlug,
            ProjectionColumnInfo
        >()

        const findHistoricalSlugForProjection = (
            projectedSlug: ColumnSlug
        ): ColumnSlug | undefined => {
            // If there is only one non-projection column, we trivially match it to the projection
            if (nonProjectionSlugs.length === 1) return nonProjectionSlugs[0]

            // Try to find a historical column with the same display name
            const displayName = table.get(projectedSlug).displayName
            return nonProjectionSlugs.find(
                (slug) => table.get(slug).displayName === displayName
            )
        }

        for (const projectedSlug of projectionSlugs) {
            const historicalSlug =
                findHistoricalSlugForProjection(projectedSlug)
            if (historicalSlug) {
                const combinedSlug = `${projectedSlug}-${historicalSlug}`
                const slugForIsProjectionColumn = `${combinedSlug}-isProjection`

                projectionColumnInfoBySlug.set(projectedSlug, {
                    projectedSlug,
                    historicalSlug,
                    combinedSlug,
                    slugForIsProjectionColumn,
                })
            }
        }

        return projectionColumnInfoBySlug
    }

    @computed get validChartTypes(): GrapherChartType[] {
        const chartTypeSet = new Set(this.chartTypes)

        // All single-chart Graphers are valid
        if (chartTypeSet.size <= 1) return Array.from(chartTypeSet)

        // Find valid combination in a pre-defined list
        const validChartTypes = findValidChartTypeCombination(
            Array.from(chartTypeSet)
        )

        // If the given combination is not valid, then ignore all but the first chart type
        if (!validChartTypes) return this.chartTypes.slice(0, 1)

        // Projected data is only supported for line charts
        const isLineChart = validChartTypes[0] === GRAPHER_CHART_TYPES.LineChart
        if (isLineChart && this.hasProjectedData) {
            return [
                GRAPHER_CHART_TYPES.LineChart,
                GRAPHER_CHART_TYPES.DiscreteBar,
            ]
        }

        return validChartTypes
    }

    @computed get validChartTypeSet(): Set<GrapherChartType> {
        return new Set(this.validChartTypes)
    }

    @computed get availableTabs(): GrapherTabName[] {
        const availableTabs: GrapherTabName[] = []
        if (this.hasTableTab) availableTabs.push(GRAPHER_TAB_NAMES.Table)
        if (this.hasMapTab) availableTabs.push(GRAPHER_TAB_NAMES.WorldMap)
        availableTabs.push(...this.validChartTypes)
        return availableTabs
    }

    @computed get hasMultipleChartTypes(): boolean {
        return this.validChartTypes.length > 1
    }

    @computed get currentSubtitle(): string {
        const subtitle = this.subtitle
        if (subtitle !== undefined) return subtitle
        const yColumns = this.yColumnsFromDimensions
        if (yColumns.length === 1) return yColumns[0].def.descriptionShort ?? ""
        return ""
    }

    @computed get shouldAddEntitySuffixToTitle(): boolean {
        const selectedEntityNames = this.selection.selectedEntityNames
        const showEntityAnnotation = !this.hideAnnotationFieldsInTitle?.entity

        const seriesStrategy =
            this.chartState.seriesStrategy ||
            autoDetectSeriesStrategy(this, true)

        return !!(
            !this.forceHideAnnotationFieldsInTitle?.entity &&
            this.isOnChartTab &&
            (seriesStrategy !== SeriesStrategy.entity || !this.showLegend) &&
            selectedEntityNames.length === 1 &&
            (showEntityAnnotation ||
                this.canChangeEntity ||
                this.canSelectMultipleEntities)
        )
    }

    @computed get shouldAddTimeSuffixToTitle(): boolean {
        const showTimeAnnotation = !this.hideAnnotationFieldsInTitle?.time
        return (
            !this.forceHideAnnotationFieldsInTitle?.time &&
            this.isReady &&
            (showTimeAnnotation ||
                (this.hasTimeline &&
                    // Chart types that refer to the current time only in the timeline
                    (this.isOnDiscreteBarTab ||
                        this.isOnStackedDiscreteBarTab ||
                        this.isOnMarimekkoTab ||
                        this.isOnMapTab)))
        )
    }

    @computed get shouldAddChangeInPrefixToTitle(): boolean {
        const showChangeInPrefix =
            !this.hideAnnotationFieldsInTitle?.changeInPrefix
        return (
            !this.forceHideAnnotationFieldsInTitle?.changeInPrefix &&
            (this.isOnLineChartTab || this.isOnSlopeChartTab) &&
            this.isRelativeMode &&
            showChangeInPrefix
        )
    }

    @computed get currentTitle(): string {
        let text = this.displayTitle.trim()
        if (text.length === 0) return text

        // Helper function to add an annotation fragment to the title;
        // only adds a comma if the text does not end with a question mark
        const appendAnnotationField = (
            text: string,
            annotation: string
        ): string => {
            const separator = text.endsWith("?") ? "" : ","
            return `${text}${separator} ${annotation}`
        }

        if (this.shouldAddEntitySuffixToTitle) {
            const selectedEntityNames = this.selection.selectedEntityNames
            const entityStr = selectedEntityNames[0]
            if (entityStr?.length) text = appendAnnotationField(text, entityStr)
        }

        if (this.shouldAddChangeInPrefixToTitle)
            text = "Change in " + lowerCaseFirstLetterUnlessAbbreviation(text)

        if (this.shouldAddTimeSuffixToTitle && this.timeTitleSuffix)
            text = appendAnnotationField(text, this.timeTitleSuffix)

        return text.trim()
    }

    /**
     * Uses some explicit and implicit information to decide whether a timeline is shown.
     */
    @computed get hasTimeline(): boolean {
        // We don't have more than one distinct time point in our data, so it doesn't make sense to show a timeline
        if (this.times.length <= 1) return false

        switch (this.activeTab) {
            // The map tab has its own `hideTimeline` option
            case GRAPHER_TAB_NAMES.WorldMap:
                return !this.map.hideTimeline

            // Use the chart-level `hideTimeline` option for the table, with some exceptions
            case GRAPHER_TAB_NAMES.Table:
                // Always show the timeline for charts that plot time on the x-axis
                if (this.hasTimeDimension) return true
                return !this.hideTimeline

            // Use the chart-level `hideTimeline` option
            default:
                return !this.hideTimeline
        }
    }

    @computed private get areHandlesOnSameTime(): boolean {
        const times = sortNumeric(this.table.timeColumn.uniqValues.slice())
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

    private getSlugForProperty(
        property: DimensionProperty
    ): string | undefined {
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

    @computed get numericColorColumnSlug(): string | undefined {
        if (!this.colorColumnSlug) return undefined

        const colorColumn = this.inputTable.get(this.colorColumnSlug)
        if (!colorColumn.isMissing && colorColumn.hasNumberFormatting)
            return this.colorColumnSlug

        return undefined
    }

    @computed get categoricalColorColumnSlug(): string | undefined {
        if (!this.colorColumnSlug) return undefined
        return this.numericColorColumnSlug ? undefined : this.colorColumnSlug
    }

    @computed private get yScaleType(): ScaleType | undefined {
        return this.yAxis.scaleType
    }

    @computed private get timeTitleSuffix(): string | undefined {
        const timeColumn = this.table.timeColumn
        if (timeColumn.isMissing) return undefined // Do not show year until data is loaded
        const { startTime, endTime } = this
        if (startTime === undefined || endTime === undefined) return undefined

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

    /** Columns that are used as a dimension in the currently active view */
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

        const columnSlugs = excludeUndefined([
            ...yColumnSlugs,
            xColumnSlug,
            sizeColumnSlug,
            colorColumnSlug,
        ])

        return this.inputTable
            .getColumns(_.uniq(columnSlugs))
            .filter(
                (column) =>
                    !!column.source.name || !_.isEmpty(column.def.origins)
            )
    }

    private set facetStrategy(facet: FacetStrategy) {
        this.selectedFacetStrategy = facet
    }

    set baseFontSize(val: number) {
        this._baseFontSize = val
    }

    private getColumnSlugsForCondensedSources(): string[] {
        const { xColumnSlug, sizeColumnSlug, colorColumnSlug, hasMarimekko } =
            this
        const columnSlugs: string[] = []

        // Exclude "Countries Continent" if it's used as the color dimension in a scatter plot, slope chart etc.
        if (
            colorColumnSlug !== undefined &&
            !isContinentsVariableId(colorColumnSlug)
        )
            columnSlugs.push(colorColumnSlug)

        if (xColumnSlug !== undefined) {
            const xColumn = this.inputTable.get(xColumnSlug)
                .def as OwidColumnDef
            // Exclude population variable if it's used as the x dimension in a marimekko
            if (
                !hasMarimekko ||
                !isPopulationVariableETLPath(xColumn?.catalogPath ?? "")
            )
                columnSlugs.push(xColumnSlug)
        }

        // Exclude population variable if it's used as the size dimension in a scatter plot
        if (sizeColumnSlug !== undefined) {
            const sizeColumn = this.inputTable.get(sizeColumnSlug)
                .def as OwidColumnDef
            if (!isPopulationVariableETLPath(sizeColumn?.catalogPath ?? ""))
                columnSlugs.push(sizeColumnSlug)
        }
        return columnSlugs
    }

    @computed private get columnsWithSourcesCondensed(): CoreColumn[] {
        const { yColumnSlugs } = this

        const columnSlugs = [...yColumnSlugs]
        columnSlugs.push(...this.getColumnSlugsForCondensedSources())

        return this.inputTable
            .getColumns(_.uniq(columnSlugs))
            .filter(
                (column) =>
                    !!column.source.name || !_.isEmpty(column.def.origins)
            )
    }

    @computed private get defaultSourcesLine(): string {
        const attributions = this.columnsWithSourcesCondensed.flatMap(
            (column) => {
                const { presentation = {} } = column.def
                // If the variable metadata specifies an attribution on the
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

        const uniqueAttributions = _.uniq(_.compact(attributions))

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

    @computed get yColumnsFromDimensionsOrSlugsOrAuto(): CoreColumn[] {
        return this.yColumnsFromDimensions.length
            ? this.yColumnsFromDimensions
            : this.table.getColumns(autoDetectYColumnSlugs(this))
    }

    @computed get defaultTitle(): string {
        const yColumns = this.yColumnsFromDimensionsOrSlugsOrAuto

        if (this.isScatter)
            return this.axisDimensions
                .map(
                    (dimension) =>
                        dimension.column.titlePublicOrDisplayName.title
                )
                .join(" vs. ")

        const uniqueDatasetNames = _.uniq(
            excludeUndefined(
                yColumns.map((col) => (col.def as OwidColumnDef).datasetName)
            )
        )

        if (this.hasMultipleYColumns && uniqueDatasetNames.length === 1)
            return uniqueDatasetNames[0]

        if (yColumns.length === 2)
            return yColumns
                .map((col) => col.titlePublicOrDisplayName.title)
                .join(" and ")

        return yColumns
            .map((col) => col.titlePublicOrDisplayName.title)
            .join(", ")
    }

    @computed get displayTitle(): string {
        if (this.title) return this.title
        if (this.isReady) return this.defaultTitle
        return ""
    }

    @computed get isLineChart(): boolean {
        return (
            this.chartType === GRAPHER_CHART_TYPES.LineChart || !this.chartType
        )
    }

    @computed get isScatter(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.ScatterPlot
    }

    @computed get isStackedArea(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.StackedArea
    }

    @computed get isSlopeChart(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.SlopeChart
    }

    @computed get isDiscreteBar(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.DiscreteBar
    }

    @computed get isStackedBar(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.StackedBar
    }

    @computed get isMarimekko(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.Marimekko
    }

    @computed get isStackedDiscreteBar(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.StackedDiscreteBar
    }

    @computed get isOnLineChartTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.LineChart
    }

    @computed get isOnScatterTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.ScatterPlot
    }

    @computed get isOnStackedAreaTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.StackedArea
    }

    @computed get isOnSlopeChartTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.SlopeChart
    }

    @computed get isOnDiscreteBarTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.DiscreteBar
    }

    @computed get isOnStackedBarTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.StackedBar
    }

    @computed get isOnMarimekkoTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.Marimekko
    }

    @computed get isOnStackedDiscreteBarTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.StackedDiscreteBar
    }

    @computed get hasLineChart(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.LineChart)
    }

    @computed get hasSlopeChart(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.SlopeChart)
    }

    @computed get hasDiscreteBar(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.DiscreteBar)
    }

    @computed get hasMarimekko(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.Marimekko)
    }

    @computed get hasScatter(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.ScatterPlot)
    }

    @computed get supportsMultipleYColumns(): boolean {
        return !this.isScatter
    }

    @computed private get xDimension(): ChartDimension | undefined {
        return this.filledDimensions.find(
            (d) => d.property === DimensionProperty.x
        )
    }

    /** Overrides the x axis dimension to target a special year */
    @computed get xOverrideTime(): number | undefined {
        return this.xDimension?.targetYear
    }

    set xOverrideTime(value: number | undefined) {
        this.xDimension!.targetYear = value
    }

    @computed get defaultBounds(): Bounds {
        return new Bounds(0, 0, DEFAULT_GRAPHER_WIDTH, DEFAULT_GRAPHER_HEIGHT)
    }

    generateStaticSvg(
        renderToHtmlString: (element: React.ReactElement) => string
    ): string {
        const _isExportingToSvgOrPng = this.isExportingToSvgOrPng
        this.isExportingToSvgOrPng = true

        const innerHTML = renderToHtmlString(<Chart manager={this} />)

        this.isExportingToSvgOrPng = _isExportingToSvgOrPng
        return innerHTML
    }

    @computed get staticBoundsWithDetails(): Bounds {
        const includeDetails =
            this.shouldIncludeDetailsInStaticExport &&
            !_.isEmpty(this.detailRenderers)

        let height = this.staticBounds.height
        if (includeDetails) {
            height +=
                2 * GRAPHER_FRAME_PADDING_VERTICAL +
                sumTextWrapHeights(
                    this.detailRenderers,
                    STATIC_EXPORT_DETAIL_SPACING
                )
        }

        return new Bounds(0, 0, this.staticBounds.width, height)
    }

    rasterize: GrapherRasterizeFn = ({ includeDetails }) => {
        const _shouldIncludeDetailsInStaticExport =
            this.shouldIncludeDetailsInStaticExport
        this.shouldIncludeDetailsInStaticExport = includeDetails

        const { width, height } = this.staticBoundsWithDetails

        try {
            // We need to ensure `rasterize` is only called on the client-side, otherwise this will fail
            const staticSVG = this.generateStaticSvg(
                reactRenderToStringClientOnly
            )
            return new StaticChartRasterizer(staticSVG, width, height).render()
        } finally {
            this.shouldIncludeDetailsInStaticExport =
                _shouldIncludeDetailsInStaticExport
        }
    }

    @computed get disableIntroAnimation(): boolean {
        return this.isStatic
    }

    @computed get mapConfig(): MapConfig {
        return this.map
    }

    @computed get relativeToggleLabel(): string {
        if (this.isOnScatterTab) return "Display average annual change"
        else if (this.isOnLineChartTab || this.isOnSlopeChartTab)
            return "Display relative change"
        return "Display relative values"
    }

    @computed get isRelativeMode(): boolean {
        // Don't allow relative mode in some cases
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
            isOnLineChartTab,
            isOnSlopeChartTab,
            hideRelativeToggle,
            areHandlesOnSameTime,
            yScaleType,
            hasSingleEntityInFacets,
            hasSingleMetricInFacets,
            xColumnSlug,
            isOnMarimekkoTab,
            isStackedChartSplitByMetric,
        } = this

        if (isOnLineChartTab || isOnSlopeChartTab)
            return (
                !hideRelativeToggle &&
                !areHandlesOnSameTime &&
                yScaleType !== ScaleType.log
            )

        // Exclude relative mode with just one metric or entity
        if (
            hasSingleEntityInFacets ||
            hasSingleMetricInFacets ||
            isStackedChartSplitByMetric
        )
            return false

        if (isOnMarimekkoTab && xColumnSlug === undefined) return false
        return !hideRelativeToggle
    }

    @computed private get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    /** externalBounds should be set to the available plotting area for a
        Grapher that resizes itself to fit. When this area changes,
        externalBounds should be updated. Updating externalBounds can
        trigger a bunch of somewhat expensive recalculations so it might
        be worth debouncing updates (e.g. when drag-resizing) */
    @computed get externalBounds(): Bounds {
        const { _externalBounds, initialOptions } = this
        return (
            _externalBounds ?? initialOptions.bounds ?? DEFAULT_GRAPHER_BOUNDS
        )
    }

    set externalBounds(bounds: Bounds) {
        this._externalBounds = bounds
    }

    @computed get isPortrait(): boolean {
        return (
            this.externalBounds.width < this.externalBounds.height &&
            this.externalBounds.width < DEFAULT_GRAPHER_WIDTH
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
            isExportingToSvgOrPng,
            externalBounds,
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
            this.manager ||
            isInIFrame
        )
            return false

        // If the user is using interactive version and then goes to export chart, use current bounds to maintain WYSIWYG
        if (isExportingToSvgOrPng) return false

        // In the editor, we usually want ideal bounds, except when we're rendering a static preview;
        // in that case, we want to use the given static bounds
        if (isEditor) return !this.isExportingToSvgOrPng

        // If the available space is very small, we use all of the space given to us
        if (
            externalBounds.height < heightForDeviceOrientation ||
            externalBounds.width < widthForDeviceOrientation
        )
            return false

        return true
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed private get scaleToFitIdeal(): number {
        return Math.min(
            (this.availableWidth * 0.95) / this.widthForDeviceOrientation,
            (this.availableHeight * 0.95) / this.heightForDeviceOrientation
        )
    }

    @computed private get fullScreenPadding(): number {
        const { windowInnerWidth } = this
        if (!windowInnerWidth) return 0
        return windowInnerWidth < 940 ? 0 : 40
    }

    @computed get hideFullScreenButton(): boolean {
        if (this.isInFullScreenMode) return false
        if (!this.isSmall) return false
        // Hide the full screen button if the full screen height
        // is barely larger than the current chart height
        const fullScreenHeight = this.windowInnerHeight!
        return fullScreenHeight < this.frameBounds.height + 80
    }

    @computed private get availableWidth(): number {
        const {
            externalBounds,
            isInFullScreenMode,
            windowInnerWidth,
            fullScreenPadding,
        } = this

        return Math.floor(
            isInFullScreenMode
                ? windowInnerWidth! - 2 * fullScreenPadding
                : externalBounds.width
        )
    }

    @computed private get availableHeight(): number {
        const {
            externalBounds,
            isInFullScreenMode,
            windowInnerHeight,
            fullScreenPadding,
        } = this

        return Math.floor(
            isInFullScreenMode
                ? windowInnerHeight! - 2 * fullScreenPadding
                : externalBounds.height
        )
    }

    @computed private get idealWidth(): number {
        return Math.floor(this.widthForDeviceOrientation * this.scaleToFitIdeal)
    }

    @computed private get idealHeight(): number {
        return Math.floor(
            this.heightForDeviceOrientation * this.scaleToFitIdeal
        )
    }

    /** Bounds of the entire Grapher frame including the chart area and entity selector panel */
    @computed get frameBounds(): Bounds {
        return this.useIdealBounds
            ? new Bounds(0, 0, this.idealWidth, this.idealHeight)
            : new Bounds(0, 0, this.availableWidth, this.availableHeight)
    }

    @computed get activeBounds(): Bounds {
        return this.isExportingToSvgOrPng ? this.staticBounds : this.frameBounds
    }

    /** Bounds of the CaptionedChart that renders the header, chart area and footer */
    @computed get captionedChartBounds(): Bounds {
        // If there's no panel, the chart takes up the whole frame
        if (!this.isEntitySelectorPanelActive) return this.frameBounds

        return new Bounds(
            0,
            0,
            // The chart takes up 9 columns in 12-column grid
            (9 / 12) * this.frameBounds.width,
            this.frameBounds.height - 2 // 2px accounts for the border
        )
    }

    @computed get chartAreaPadding(): number {
        // Choose padding based on chart size, ensuring it's at most 24px
        return Math.min(24, Math.ceil(0.025 * this.activeBounds.width))
    }

    /** Bounds of the chart area if no CaptionedChart is rendered */
    @computed get chartAreaBounds(): Bounds {
        return this.activeBounds.pad(this.chartAreaPadding)
    }

    /** Bounds of the entity selector if rendered into the side panel */
    @computed get sidePanelBounds(): Bounds | undefined {
        if (!this.isEntitySelectorPanelActive) return

        return new Bounds(
            0, // not in use; intentionally set to zero
            0, // not in use; intentionally set to zero
            this.frameBounds.width - this.captionedChartBounds.width,
            this.captionedChartBounds.height
        )
    }

    @computed get containerElement(): HTMLDivElement | undefined {
        return this.base.current || undefined
    }

    @computed private get analyticsContext(): GrapherAnalyticsContext {
        const ctx = this.manager?.analyticsContext
        return {
            slug: ctx?.mdimSlug ?? this.slug,
            viewConfigId: ctx?.mdimViewConfigId,
            narrativeChartName: this.narrativeChartInfo?.name,
        }
    }

    logEntitySelectorEvent(action: EntitySelectorEvent, target?: string): void {
        this.analytics.logEntitySelectorEvent(action, {
            ...this.analyticsContext,
            target,
        })
    }

    logImageDownloadEvent(action: GrapherImageDownloadEvent): void {
        this.analytics.logGrapherImageDownloadEvent(action, {
            ...this.analyticsContext,
            context: omitUndefinedValues({
                tab: this.activeTab,
                globe: this.isOnMapTab
                    ? this.mapConfig.globe.isActive
                    : undefined,
            }),
        })
    }

    logGrapherInteractionEvent(
        action: GrapherInteractionEvent,
        target?: string
    ): void {
        this.analytics.logGrapherInteractionEvent(action, {
            ...this.analyticsContext,
            target,
        })
    }

    formatTimeFn(time: Time): string {
        return this.inputTable.timeColumn.formatTime(time)
    }

    @computed get timeColumn(): TimeColumn | undefined {
        const timeColumn = this.inputTable.timeColumn
        if (timeColumn instanceof MissingColumn) return undefined
        return timeColumn
    }

    @computed get availableEntityNames(): EntityName[] {
        return this.tableForSelection.availableEntityNames
    }

    @computed get entityRegionTypeGroups(): EntityRegionTypeGroup[] {
        return groupEntityNamesByRegionType(this.availableEntityNames)
    }

    @computed get entityNamesByRegionType(): EntityNamesByRegionType {
        return new Map(
            this.entityRegionTypeGroups.map(({ regionType, entityNames }) => [
                regionType,
                entityNames,
            ])
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
            !this.isOnMarimekkoTab &&
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
            isOnStackedDiscreteBarTab,
            isOnStackedAreaTab,
            isOnStackedBarTab,
            selectedFacetStrategy,
            hasMultipleYColumns,
        } = this

        if (isOnStackedDiscreteBarTab) {
            return (
                selectedFacetStrategy === FacetStrategy.entity ||
                selectedFacetStrategy === FacetStrategy.metric
            )
        }

        if (isOnStackedAreaTab || isOnStackedBarTab) {
            return (
                selectedFacetStrategy === FacetStrategy.entity &&
                !hasMultipleYColumns
            )
        }

        return false
    }

    @computed private get hasSingleEntityInFacets(): boolean {
        const {
            isOnStackedAreaTab,
            isOnStackedBarTab,
            selectedFacetStrategy,
            selection,
        } = this

        if (isOnStackedAreaTab || isOnStackedBarTab) {
            return (
                selectedFacetStrategy === FacetStrategy.metric &&
                selection.numSelectedEntities === 1
            )
        }

        return false
    }

    // TODO: remove once #2136 is fixed
    // Issue #2136 describes a correctness bug that relates to relative mode and
    // affects all stacked area/bar charts that are split by metric. For now,
    // we simply turn off relative mode in such cases. Once the bug is properly
    // addressed, this computed property and its references can be removed
    @computed
    private get isStackedChartSplitByMetric(): boolean {
        return (
            (this.isOnStackedAreaTab || this.isOnStackedBarTab) &&
            this.selectedFacetStrategy === FacetStrategy.metric
        )
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        return this.chartState.availableFacetStrategies?.length
            ? this.chartState.availableFacetStrategies
            : [FacetStrategy.none]
    }

    /** The actual facet setting used by a chart, potentially overriding selectedFacetStrategy */
    @computed get facetStrategy(): FacetStrategy {
        if (
            this.selectedFacetStrategy &&
            this.availableFacetStrategies.includes(this.selectedFacetStrategy)
        )
            return this.selectedFacetStrategy

        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.selection.selectedEntityNames.length > 1
        ) {
            return FacetStrategy.entity
        }

        if (this.availableFacetStrategies.length === 0)
            throw new Error("No facet strategy available")

        return firstOfNonEmptyArray(this.availableFacetStrategies)
    }

    @computed get isFaceted(): boolean {
        // Show map facets if start and end time are different
        if (this.isOnMapTab) return this.startTime !== this.endTime

        const hasFacetStrategy = this.facetStrategy !== FacetStrategy.none
        return this.isOnChartTab && hasFacetStrategy
    }

    @computed get hasMultipleSeriesPerFacet(): boolean {
        return (
            this.isFaceted &&
            this.selection.numSelectedEntities > 1 &&
            this.yColumnSlugs.length > 1
        )
    }

    @computed get isInFullScreenMode(): boolean {
        return this._isInFullScreenMode
    }

    set isInFullScreenMode(newValue: boolean) {
        // Prevent scrolling when in full-screen mode
        if (newValue) {
            document.documentElement.classList.add("no-scroll")
        } else {
            document.documentElement.classList.remove("no-scroll")
        }

        // Dismiss the share menu
        this.isShareMenuActive = false

        this._isInFullScreenMode = newValue
    }

    @action.bound setHideExternalControlsInEmbedUrl(value: boolean): void {
        this.hideExternalControlsInEmbedUrl = value
    }

    @computed get isModalOpen(): boolean {
        return this.isEntitySelectorModalOpen || this.activeModal !== undefined
    }

    // Whether a server-side download is available for the download modal
    @computed get isServerSideDownloadAvailable(): boolean {
        return (
            // We're not on an archival grapher page
            !this.isOnArchivalPage &&
            // We're not inside the admin
            window.admin === undefined &&
            // We're not in a narrative chart
            !this.narrativeChartInfo &&
            // We have a baseUrl to send the request to
            !!this.baseUrl
        )
    }

    @computed get baseFontSize(): number {
        if (this.isStatic && this.initialOptions.baseFontSize)
            return this.initialOptions.baseFontSize
        if (this.isStaticAndSmall) {
            return this.computeBaseFontSizeFromHeight(this.staticBounds)
        }
        if (this.isStatic) return 18
        return this._baseFontSize
    }

    // The header and footer don't rely on the base font size unless explicitly specified
    @computed get useBaseFontSize(): boolean {
        return this.initialOptions.baseFontSize !== undefined
    }

    private computeBaseFontSizeFromHeight(bounds: Bounds): number {
        const squareBounds = DEFAULT_GRAPHER_BOUNDS_SQUARE
        const factor = squareBounds.height / 21
        return Math.max(10, bounds.height / factor)
    }

    computeBaseFontSizeFromWidth(bounds: Bounds): number {
        if (bounds.width <= 400) return 14
        else if (bounds.width < 1080) return 16
        else if (bounds.width >= 1080) return 18
        else return 16
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    @computed get isNarrow(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 420
    }

    @computed get isSemiNarrow(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 550
    }

    /**
     * Small charts are typically rendered into 6 or 7 columns in a 12-column
     * grid layout (e.g. side-by-side charts or charts in the All Charts block)
     */
    @computed get isSmall(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 740
    }

    /**
     * Medium charts are typically rendered into 8 columns in a 12-column
     * grid layout (e.g. stand-alone charts in the main text of an article)
     */
    @computed get isMedium(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 845
    }

    @computed get isStaticAndSmall(): boolean {
        if (!this.isStatic) return false
        return this.areStaticBoundsSmall
    }

    @computed private get areStaticBoundsSmall(): boolean {
        const { defaultBounds, staticBounds } = this
        const idealPixelCount = defaultBounds.width * defaultBounds.height
        const staticPixelCount = staticBounds.width * staticBounds.height
        return staticPixelCount < 0.66 * idealPixelCount
    }

    @computed get isExportingForWikimedia(): boolean {
        return this.isExportingToSvgOrPng && this.isWikimediaExport
    }

    @computed get backgroundColor(): Color {
        return GRAPHER_BACKGROUND_DEFAULT
    }

    @computed get shouldPinTooltipToBottom(): boolean {
        return this.isTouchDevice
    }

    @computed private get hasRelatedQuestion(): boolean {
        if (
            this.hideRelatedQuestion ||
            !this.relatedQuestions ||
            !this.relatedQuestions.length
        )
            return false
        const question = this.relatedQuestions[0]
        return !!question && !!question.text && !!question.url
    }

    @computed
    private get isRelatedQuestionTargetDifferentFromCurrentPage(): boolean {
        // Comparing paths rather than full URLs for this to work as
        // expected on local and staging where the origin (e.g.
        // hans.owid.cloud) doesn't match the production origin that has
        // been entered in the related question URL field:
        // "ourworldindata.org" and yet should still yield a match.
        // - Note that this won't work on production previews (where the
        //   path is /admin/posts/preview/ID)
        const { relatedQuestions = [], hasRelatedQuestion } = this
        const relatedQuestion = relatedQuestions[0]
        return (
            hasRelatedQuestion &&
            !!relatedQuestion &&
            getWindowUrl().pathname !==
                Url.fromURL(relatedQuestion.url).pathname
        )
    }

    @computed get showRelatedQuestion(): boolean {
        return (
            !!this.relatedQuestions &&
            !!this.hasRelatedQuestion &&
            !!this.isRelatedQuestionTargetDifferentFromCurrentPage
        )
    }

    @action.bound clearSelection(): void {
        this.selection.clearSelection()
        this.applyOriginalSelectionAsAuthored()
    }

    @action.bound private clearFocus(): void {
        this.focusArray.clear()
        this.applyOriginalFocusAsAuthored()
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
        this.map.startTime = authorsVersion.map.startTime
        this.map.region = authorsVersion.map.region
        this.showNoDataArea = authorsVersion.showNoDataArea
        this.dataTableConfig.filter = authorsVersion.dataTableConfig.filter
        this.dataTableConfig.search = authorsVersion.dataTableConfig.search
        this.mapConfig.globe.isActive = authorsVersion.mapConfig.globe.isActive
        this.clearSelection()
        this.clearFocus()
        this.mapConfig.selection.clearSelection()
    }

    /**
     * Resets the Grapher to a blank slate, so that if you updateFromObject and
     * the object contains some blanks, those blanks won't overwrite defaults.
     */
    @action.bound reset(): void {
        const grapherState = new GrapherState({})
        for (const key of grapherKeysToSerialize) {
            // @ts-expect-error grapherKeysToSerialize is not properly typed
            this[key] = grapherState[key]
        }
        this.seriesColorMap = new Map()

        this.ySlugs = grapherState.ySlugs
        this.xSlug = grapherState.xSlug
        this.colorSlug = grapherState.colorSlug
        this.sizeSlug = grapherState.sizeSlug

        this.selection.clearSelection()
        this.focusArray.clear()
    }

    @computed.struct private get allParams(): GrapherQueryParams {
        return grapherObjectToQueryParams(this)
    }

    @computed get overlayParam(): string | undefined {
        if (!this.activeModal) return undefined
        return match(this.activeModal)
            .with(GrapherModal.Download, () => {
                return match(this.activeDownloadModalTab)
                    .with(DownloadModalTabName.Data, () => "download-data")
                    .with(DownloadModalTabName.Vis, () => "download-vis")
                    .exhaustive()
            })
            .with(GrapherModal.Embed, () => {
                // We could include the embed modal in the `overlay=` params,
                // but there has been an issue in the past where we accidentally
                // included that in the Embed dialog's URL, and then embeds would
                // always show the modal. Linking directly to the modal doesn't
                // have much of a use case, anyway.
                return undefined
            })
            .with(GrapherModal.Sources, () => "sources")
            .exhaustive()
    }

    @computed get areSelectedEntitiesDifferentThanAuthors(): boolean {
        const authoredConfig = this.legacyConfigAsAuthored
        const currentSelectedEntityNames = this.selection.selectedEntityNames
        const originalSelectedEntityNames =
            authoredConfig.selectedEntityNames ?? []

        return isArrayDifferentFromReference(
            currentSelectedEntityNames,
            originalSelectedEntityNames
        )
    }

    @computed get areFocusedSeriesNamesDifferentThanAuthors(): boolean {
        const authoredConfig = this.legacyConfigAsAuthored
        const currentFocusedSeriesNames = this.focusArray.seriesNames
        const originalFocusedSeriesNames =
            authoredConfig.focusedSeriesNames ?? []

        return isArrayDifferentFromReference(
            currentFocusedSeriesNames,
            originalFocusedSeriesNames
        )
    }

    /**
     * Autocomputed url params to reflect difference between current grapher state
     * and original config state
     */
    @computed.struct get changedParams(): Partial<GrapherQueryParams> {
        return differenceObj(this.allParams, this.authorsVersion.allParams)
    }

    /** Useful to compare current state against the published grapher */
    @computed private get authorsVersion(): GrapherState {
        return new GrapherState({
            ...this.legacyConfigAsAuthored,
            manager: undefined,
            queryStr: "",
        })
    }

    @computed get queryStr(): string {
        if (this.manager?.queryStr !== undefined) return this.manager.queryStr

        return queryParamsToStr({
            ...this.changedParams,
            ...this.externalQueryParams,
        })
    }

    /** Static root URL of the chart, e.g. https://ourworldindata.org/grapher/life-expectancy */
    @computed get baseUrl(): string | undefined {
        if (this.isOnArchivalPage) return this.archiveContext?.archiveUrl

        if (this.manager?.baseUrl) return this.manager.baseUrl

        return this.isPublished
            ? `${this.bakedGrapherURL ?? "/grapher"}/${this.displaySlug}`
            : undefined
    }

    @computed private get canonicalUrlIfIsNarrativeChart(): string | undefined {
        if (!this.narrativeChartInfo) return undefined

        const { parentChartSlug, queryParamsForParentChart } =
            this.narrativeChartInfo

        const combinedQueryParams = {
            ...queryParamsForParentChart,
            ...this.changedParams,
        }

        return `${this.bakedGrapherURL}/${parentChartSlug}${queryParamsToStr(
            combinedQueryParams
        )}`
    }

    /**
     * Full URL representing the canonical location of this grapher state,
     * e.g. https://ourworldindata.org/grapher/life-expectancy?tab=map
     */
    @computed get canonicalUrl(): string | undefined {
        return (
            this.canonicalUrlIfIsNarrativeChart ??
            (this.baseUrl ? this.baseUrl + this.queryStr : undefined)
        )
    }

    @computed get isOnCanonicalUrl(): boolean {
        if (!this.canonicalUrl) return false
        return (
            getWindowUrl().pathname === Url.fromURL(this.canonicalUrl).pathname
        )
    }

    private makeEmbedUrl(baseUrl: string): string {
        let url = Url.fromURL(baseUrl)
        // We want to preserve the tab in the embed URL so that if we change the
        // default view of the chart, it won't change existing embeds.
        // See https://github.com/owid/owid-grapher/issues/2805
        const { tab } = this.allParams
        if (tab && !url.queryParams.tab) {
            url = url.updateQueryParams({ tab })
        }
        if (this.canHideExternalControlsInEmbed) {
            url = url.updateQueryParams({
                hideControls: this.hideExternalControlsInEmbedUrl.toString(),
            })
        }
        return url.fullUrl
    }

    @computed get embedUrl(): string | undefined {
        const baseUrl = this.canonicalUrl
        if (!baseUrl) return undefined
        return this.makeEmbedUrl(baseUrl)
    }

    @computed get embedArchivedUrl(): string | undefined {
        if (!this.archiveContext) return undefined
        const baseUrl = this.archiveContext.archiveUrl + this.queryStr
        return this.makeEmbedUrl(baseUrl)
    }

    @computed get hasUserChangedTimeHandles(): boolean {
        const authorsVersion = this.authorsVersion
        return (
            this.minTime !== authorsVersion.minTime ||
            this.maxTime !== authorsVersion.maxTime
        )
    }

    @computed private get hasUserChangedMapTimeHandle(): boolean {
        const authorsVersion = this.authorsVersion
        return (
            this.map.startTime !== authorsVersion.map.startTime ||
            this.map.time !== authorsVersion.map.time
        )
    }

    @computed get timeParam(): string | undefined {
        const { timeColumn } = this.table
        const formatTime = (time: Time): string =>
            timeBoundToTimeBoundString(
                time,
                timeColumn instanceof ColumnTypeMap.Day
            )

        if (this.isOnMapTab) {
            if (!this.hasUserChangedMapTimeHandle) return undefined
            if (this.map.time === undefined) return undefined

            if (this.map.startTime === undefined)
                return formatTime(this.map.time)

            const startTime = formatTime(this.map.startTime)
            const endTime = formatTime(this.map.time)

            return startTime === endTime
                ? startTime
                : `${startTime}..${endTime}`
        }

        if (!this.hasUserChangedTimeHandles) return undefined

        const [startTime, endTime] =
            this.timelineHandleTimeBounds.map(formatTime)
        return startTime === endTime ? startTime : `${startTime}..${endTime}`
    }

    private dismissTooltip(): void {
        const tooltip = this.tooltip?.get()
        if (tooltip) tooltip.dismiss?.()
    }

    @action.bound onTimelineClick(): void {
        this.dismissTooltip()
    }

    // Called when an entity is selected in the entity selector
    @action.bound onSelectEntity(entityName: EntityName): void {
        const { selectedCountryNamesInForeground } = this.mapConfig.selection

        if (!this.isOnMapTab || !this.isMapSelectionEnabled) return

        const region = getRegionByName(entityName)
        if (!region) return

        if (this.mapConfig.globe.isActive) {
            if (
                checkIsCountry(region) &&
                region.isMappable &&
                selectedCountryNamesInForeground.includes(region.name)
            ) {
                // Rotate to the selected country
                this.globeController.rotateToCountry(region.name)
                this.mapConfig.region = MapRegionName.World
            } else if (checkIsOwidContinent(region)) {
                // Rotate to the selected owid continent
                const regionName = MAP_REGION_NAMES[
                    region.name
                ] as GlobeRegionName
                this.globeController.rotateToOwidContinent(regionName)
                this.mapConfig.region = regionName
            } else if (checkIsIncomeGroup(region)) {
                // Switch back to the 2d map if an income group is selected
                this.globeController.hideGlobe()
                this.globeController.resetGlobe()
                this.mapConfig.region = MapRegionName.World
            } else if (checkHasMembers(region)) {
                // Rotate to the selected region
                this.globeController.rotateToRegion(region.name)
                this.mapConfig.region = MapRegionName.World
            }
        }
    }

    // Called when an entity is deselected in the entity selector
    @action.bound onDeselectEntity(entityName: EntityName): void {
        // Remove focus from an entity that has been removed from the selection
        this.focusArray.remove(entityName)

        // Remove focus from the deselected country
        this.globeController.dismissCountryFocus()
    }

    // Called when all entities are cleared in the entity selector
    @action.bound onClearEntities(): void {
        // Remove focus from all entities if all entities have been deselected
        this.focusArray.clear()

        // Switch back to the 2d map if all entities were deselected
        if (this.isOnMapTab) {
            this.globeController.hideGlobe()
            this.globeController.resetGlobe()
        }
    }

    isEntityMutedInSelector(entityName: EntityName): boolean {
        // For now, muted entities are only relevant on the map tab
        if (!this.isOnMapTab) return false

        // Entities disabled on the map are muted
        if (
            this.mapConfig.selection.selectedCountryNamesInBackground.includes(
                entityName
            )
        )
            return true

        // If a 2d continent is active, then all countries outside of the continent
        // are not shown on the map, so they're muted in the entity selector as well
        if (this.mapConfig.is2dContinentActive()) {
            const region = getRegionByName(entityName)
            if (!region) return false

            // Don't mute the selected continent
            if (checkIsOwidContinent(region))
                return region.name !== MAP_REGION_LABELS[this.mapConfig.region]

            const countriesInRegion = getCountriesByRegion(
                MAP_REGION_LABELS[this.mapConfig.region]
            )
            if (!countriesInRegion) return false

            return !countriesInRegion.has(entityName)
        }

        return false
    }

    @computed get disablePlay(): boolean {
        return (
            this.isOnTableTab || this.isOnSlopeChartTab || this.isOnMarimekkoTab
        )
    }

    @computed get animationEndTime(): Time {
        const { timeColumn } = this.table
        if (this.timelineMaxTime) {
            const timesAsc = sortNumeric(timeColumn.uniqValues.slice())
            return (
                findClosestTime(timesAsc, this.timelineMaxTime) ??
                timeColumn.maxTime
            )
        }
        return timeColumn.maxTime
    }

    @computed get canSelectMultipleEntities(): boolean {
        if (this.isOnMapTab) return true

        if (this.numSelectableEntityNames < 2) return false
        if (this.addCountryMode === EntitySelectionMode.MultipleEntities)
            return true

        // If the chart is currently faceted by entity, then use multi-entity
        // selection, even if the author specified single-entity selection
        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.facetStrategy === FacetStrategy.entity
        )
            return true

        return false
    }

    @computed get canChangeEntity(): boolean {
        return (
            this.hasChartTab &&
            !this.isOnScatterTab &&
            !this.canSelectMultipleEntities &&
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.numSelectableEntityNames > 1
        )
    }

    @computed get canAddEntities(): boolean {
        return (
            this.hasChartTab &&
            this.canSelectMultipleEntities &&
            (this.isOnLineChartTab ||
                this.isOnSlopeChartTab ||
                this.isOnStackedAreaTab ||
                this.isOnStackedBarTab ||
                this.isOnDiscreteBarTab ||
                this.isOnStackedDiscreteBarTab)
        )
    }

    @computed get canHighlightEntities(): boolean {
        return (
            this.hasChartTab &&
            this.addCountryMode !== EntitySelectionMode.Disabled &&
            this.numSelectableEntityNames > 1 &&
            !this.canAddEntities &&
            !this.canChangeEntity
        )
    }

    @computed get canChangeAddOrHighlightEntities(): boolean {
        return (
            this.canChangeEntity ||
            this.canAddEntities ||
            this.canHighlightEntities
        )
    }

    @computed get shouldShowEntitySelectorAs(): GrapherWindowType {
        if (
            this.frameBounds.width > 940 &&
            // Don't use the panel if the grapher is embedded
            ((!this.isInIFrame && !this.isEmbeddedInAnOwidPage) ||
                // unless we're in full-screen mode
                this.isInFullScreenMode)
        )
            return GrapherWindowType.panel

        return this.isSemiNarrow
            ? GrapherWindowType.modal
            : GrapherWindowType.drawer
    }

    @computed private get isEntitySelectorPanelActive(): boolean {
        if (this.hideEntityControls) return false

        const shouldShowPanel =
            this.shouldShowEntitySelectorAs === GrapherWindowType.panel

        if (this.isOnMapTab && this.isMapSelectionEnabled && shouldShowPanel)
            return true

        return (
            this.isOnChartTab &&
            this.canChangeAddOrHighlightEntities &&
            shouldShowPanel
        )
    }

    @computed get isEntitySelectorModalOpen(): boolean {
        return (
            this.isEntitySelectorModalOrDrawerOpen &&
            this.shouldShowEntitySelectorAs === GrapherWindowType.modal
        )
    }

    @computed get isEntitySelectorDrawerOpen(): boolean {
        return (
            this.isEntitySelectorModalOrDrawerOpen &&
            this.shouldShowEntitySelectorAs === GrapherWindowType.drawer
        )
    }

    @computed get isMapSelectionEnabled(): boolean {
        if (this.enableMapSelection) return true

        return (
            // If the entity controls are hidden, then selecting entities from
            // the map should also be disabled
            !this.hideEntityControls &&
            // Only show the entity selector on the map tab if it's rendered
            // into the side panel or into the slide-in drawer
            this.shouldShowEntitySelectorAs !== GrapherWindowType.modal
        )
    }

    @computed private get numSelectableEntityNames(): number {
        return this.availableEntityNames.length
    }

    private mapQueryParamToTabName(tab: string): GrapherTabName | undefined {
        return isValidTabConfigOption(tab)
            ? this.mapTabConfigOptionToTabName(tab)
            : this.defaultTab
    }

    mapGrapherTabToQueryParam(tabName: GrapherTabName): string {
        return this.mapTabNameToTabConfigOption(tabName)
    }

    private mapTabNameToTabConfigOption(
        tabName: GrapherTabName
    ): GrapherTabConfigOption {
        switch (tabName) {
            case GRAPHER_TAB_NAMES.Table:
                return GRAPHER_TAB_CONFIG_OPTIONS.table
            case GRAPHER_TAB_NAMES.WorldMap:
                return GRAPHER_TAB_CONFIG_OPTIONS.map
            default:
                return this.hasMultipleChartTypes
                    ? mapChartTypeNameToTabConfigOption(tabName)
                    : GRAPHER_TAB_CONFIG_OPTIONS.chart
        }
    }

    private mapTabConfigOptionToTabName(
        tabOption: GrapherTabConfigOption
    ): GrapherTabName {
        if (tabOption === GRAPHER_TAB_CONFIG_OPTIONS.table)
            return GRAPHER_TAB_NAMES.Table

        if (tabOption === GRAPHER_TAB_CONFIG_OPTIONS.map)
            return this.hasMapTab ? GRAPHER_TAB_NAMES.WorldMap : this.defaultTab

        if (tabOption === GRAPHER_TAB_CONFIG_OPTIONS.chart) {
            return this.defaultTab
        }

        const chartTypeName = mapTabConfigOptionToChartTypeName(tabOption)
        return this.validChartTypeSet.has(chartTypeName)
            ? chartTypeName
            : this.defaultTab
    }
}

export const defaultObject = objectWithPersistablesToObject(
    new GrapherState({}),
    grapherKeysToSerialize
)
