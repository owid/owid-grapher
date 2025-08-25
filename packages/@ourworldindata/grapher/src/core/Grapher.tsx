import * as _ from "lodash-es"
import React from "react"

import {
    observable,
    computed,
    action,
    autorun,
    runInAction,
    reaction,
    makeObservable,
} from "mobx"
import {
    bind,
    slugify,
    lowerCaseFirstLetterUnlessAbbreviation,
    isMobile,
    next,
    sampleFrom,
    exposeInstanceOnWindow,
    findClosestTime,
    excludeUndefined,
    isInIFrame,
    differenceObj,
    QueryParams,
    MultipleOwidVariableDataDimensionsMap,
    Bounds,
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
    EntityYearHighlight,
    ColumnSlug,
    DimensionProperty,
    SortBy,
    SortConfig,
    SortOrder,
    OwidChartDimensionInterface,
    firstOfNonEmptyArray,
    EnrichedDetail,
    getOriginAttributionFragments,
    extractDetailsFromSyntax,
    isTouchDevice,
    isArrayDifferentFromReference,
    getRegionByName,
    checkIsCountry,
    checkIsOwidContinent,
    checkIsIncomeGroup,
    checkHasMembers,
    omitUndefinedValues,
    parseFloatOrUndefined,
} from "@ourworldindata/utils"
import {
    MarkdownTextWrap,
    sumTextWrapHeights,
    BodyDiv,
    reactRenderToStringClientOnly,
} from "@ourworldindata/components"
import {
    GrapherChartType,
    ScaleType,
    StackMode,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    FacetStrategy,
    SeriesColorMap,
    FacetAxisDomain,
    AnnotationFieldsInTitle,
    MissingDataStrategy,
    SeriesStrategy,
    GrapherInterface,
    grapherKeysToSerialize,
    GrapherQueryParams,
    LegacyGrapherInterface,
    LogoOption,
    ComparisonLineConfig,
    ColumnSlugs,
    Time,
    EntityName,
    OwidColumnDef,
    ColorSchemeName,
    AxisConfigInterface,
    DetailsMarker,
    DetailDictionary,
    GrapherWindowType,
    Color,
    GRAPHER_QUERY_PARAM_KEYS,
    GrapherTooltipAnchor,
    GrapherTabName,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GRAPHER_TAB_NAMES,
    SeriesName,
    NarrativeChartInfo,
    AssetMap,
    ArchiveContext,
    GrapherTabConfigOption,
    GlobeRegionName,
    OwidVariableRow,
    AdditionalGrapherDataFetchFn,
    ProjectionColumnInfo,
    GrapherVariant,
    GRAPHER_MAP_TYPE,
} from "@ourworldindata/types"
import {
    BlankOwidTable,
    OwidTable,
    ColumnTypeMap,
    CoreColumn,
} from "@ourworldindata/core-table"
import {
    BASE_FONT_SIZE,
    CookieKey,
    DEFAULT_GRAPHER_WIDTH,
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    STATIC_EXPORT_DETAIL_SPACING,
    GRAPHER_LOADED_EVENT_NAME,
    isContinentsVariableId,
    isPopulationVariableETLPath,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_FRAME_PADDING_VERTICAL,
    latestGrapherConfigSchema,
    DEFAULT_GRAPHER_BOUNDS,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    GrapherModal,
    CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME,
} from "../core/GrapherConstants"
import Cookies from "js-cookie"
import { ChartDimension } from "../chart/ChartDimension"
import { TooltipManager } from "../tooltip/TooltipProps"

import { DimensionSlot } from "../chart/DimensionSlot"
import {
    getEntityNamesParam,
    getFocusedSeriesNamesParam,
    getSelectedEntityNamesParam,
} from "./EntityUrlBuilder"
import { AxisConfig } from "../axis/AxisConfig"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { MapConfig } from "../mapCharts/MapConfig"
import { FullScreen } from "../fullScreen/FullScreen"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons"
import { TooltipContainer } from "../tooltip/Tooltip"
import { EntitySelectorModal } from "../modal/EntitySelectorModal"
import { DownloadModal, DownloadModalTabName } from "../modal/DownloadModal"
import { observer } from "mobx-react"
import "d3-transition"
import { SourcesModal } from "../modal/SourcesModal"
import { isValidDataTableFilter } from "../dataTable/DataTable"
import { DataTableConfig } from "../dataTable/DataTableConstants"
import { MAP_REGION_NAMES } from "../mapCharts/MapChartConstants"
import {
    isValidGlobeRegionName,
    isValidMapRegionName,
    isOnTheMap,
} from "../mapCharts/MapHelpers"
import { Command, CommandPalette } from "../controls/CommandPalette"
import { EmbedModal } from "../modal/EmbedModal"
import {
    TimelineController,
    TimelineDragTarget,
} from "../timeline/TimelineController"
import Mousetrap from "mousetrap"
import { SlideShowController } from "../slideshowController/SlideShowController"
import { makeChartState } from "../chart/ChartTypeMap"
import { SelectionArray } from "../selection/SelectionArray"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "./LegacyToOwidTable"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
} from "../chart/ChartUtils"
import {
    findValidChartTypeCombination,
    isChartTab,
    isChartTypeName,
    isMapTab,
    isValidTabConfigOption,
    mapChartTypeNameToTabConfigOption,
    mapTabConfigOptionToChartTypeName,
} from "../chart/ChartTabs"
import classnames from "classnames"
import {
    EntitySelectorEvent,
    GrapherAnalytics,
    GrapherAnalyticsContext,
    GrapherInteractionEvent,
    GrapherImageDownloadEvent,
} from "./GrapherAnalytics"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations"
import { ChartState } from "../chart/ChartInterface"
import {
    StaticChartRasterizer,
    type GrapherExport,
} from "../captionedChart/StaticChartRasterizer.js"
import { SidePanel } from "../sidePanel/SidePanel"
import {
    EntitySelector,
    type EntitySelectorState,
} from "../entitySelector/EntitySelector"
import { SlideInDrawer } from "../slideInDrawer/SlideInDrawer"
import { grapherObjectToQueryParams, parseGlobeRotation } from "./GrapherUrl.js"
import { FocusArray } from "../focus/FocusArray"
import {
    GRAPHER_BACKGROUND_BEIGE,
    GRAPHER_BACKGROUND_DEFAULT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants"
import { FacetChart } from "../facetChart/FacetChart"
import { getErrorMessageRelatedQuestionUrl } from "./relatedQuestion.js"
import { GlobeController } from "../mapCharts/GlobeController"
import { MapRegionDropdownValue } from "../controls/MapRegionDropdown"
import {
    EntityNamesByRegionType,
    EntityRegionTypeGroup,
    groupEntityNamesByRegionType,
} from "./EntitiesByRegionType"
import * as R from "remeda"
import { Chart } from "../chart/Chart.js"
import { flushSync } from "react-dom"
import { match } from "ts-pattern"

declare global {
    interface Window {
        details?: DetailDictionary
        admin?: any // TODO: use stricter type
    }
}

const DEFAULT_MS_PER_TICK = 100

// Exactly the same as GrapherInterface, but contains options that developers want but authors won't be touching.
export interface GrapherProgrammaticInterface extends GrapherInterface {
    queryStr?: string
    bounds?: Bounds
    table?: OwidTable
    bakedGrapherURL?: string
    adminBaseUrl?: string
    env?: string
    entityYearHighlight?: EntityYearHighlight
    baseFontSize?: number
    staticBounds?: Bounds
    variant?: GrapherVariant

    hideTitle?: boolean
    hideSubtitle?: boolean
    hideNote?: boolean
    hideOriginUrl?: boolean

    hideEntityControls?: boolean
    hideZoomToggle?: boolean
    hideNoDataAreaToggle?: boolean
    hideFacetYDomainToggle?: boolean
    hideXScaleToggle?: boolean
    hideYScaleToggle?: boolean
    hideMapRegionDropdown?: boolean
    forceHideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    hasTableTab?: boolean
    hideChartTabs?: boolean
    hideShareButton?: boolean
    hideExploreTheDataButton?: boolean
    hideRelatedQuestion?: boolean
    isSocialMediaExport?: boolean
    enableMapSelection?: boolean

    enableKeyboardShortcuts?: boolean
    bindUrlToWindow?: boolean
    isEmbeddedInAnOwidPage?: boolean
    isEmbeddedInADataPage?: boolean
    isConfigReady?: boolean
    canHideExternalControlsInEmbed?: boolean

    narrativeChartInfo?: MinimalNarrativeChartInfo
    archivedChartInfo?: ArchiveContext

    manager?: GrapherManager
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
}

type MinimalNarrativeChartInfo = Pick<
    NarrativeChartInfo,
    "name" | "parentChartSlug" | "queryParamsForParentChart"
>

interface AnalyticsContext {
    mdimSlug?: string
    mdimView?: Record<string, string>
}

export interface GrapherManager {
    canonicalUrl?: string
    selection?: SelectionArray
    focusArray?: FocusArray
    adminEditPath?: string
    adminCreateNarrativeChartPath?: string
    analyticsContext?: AnalyticsContext
}

export class GrapherState {
    $schema = latestGrapherConfigSchema
    chartTypes: GrapherChartType[] = [
        GRAPHER_CHART_TYPES.LineChart,
        GRAPHER_CHART_TYPES.DiscreteBar,
    ]
    id: number | undefined = undefined
    version = 1
    slug: string | undefined = undefined

    // Initializing text fields with `undefined` ensures that empty strings get serialised
    title: string | undefined = undefined
    subtitle: string | undefined = undefined
    sourceDesc: string | undefined = undefined
    note: string | undefined = undefined
    // Missing from GrapherInterface: details
    internalNotes: string | undefined = undefined
    variantName: string | undefined = undefined
    originUrl: string | undefined = undefined
    hideAnnotationFieldsInTitle: AnnotationFieldsInTitle | undefined = undefined

    minTime: TimeBound | undefined = undefined
    maxTime: TimeBound | undefined = undefined
    timelineMinTime: Time | undefined = undefined
    timelineMaxTime: Time | undefined = undefined
    addCountryMode = EntitySelectionMode.MultipleEntities
    stackMode = StackMode.absolute
    showNoDataArea = true
    hideLegend: boolean | undefined = false
    logo: LogoOption | undefined = undefined
    hideLogo: boolean | undefined = undefined
    hideRelativeToggle: boolean | undefined = true
    entityType = DEFAULT_GRAPHER_ENTITY_TYPE
    entityTypePlural = DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL
    facettingLabelByYVariables = "metric"
    hideTimeline: boolean | undefined = undefined
    zoomToSelection: boolean | undefined = undefined
    showYearLabels: boolean | undefined = undefined // Always show year in labels for bar charts
    hasMapTab = false
    tab: GrapherTabConfigOption = GRAPHER_TAB_CONFIG_OPTIONS.chart
    isPublished: boolean | undefined = undefined
    baseColorScheme: ColorSchemeName | undefined = undefined
    invertColorScheme: boolean | undefined = undefined
    hideConnectedScatterLines: boolean | undefined = undefined // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    hideScatterLabels: boolean | undefined = undefined
    scatterPointLabelStrategy: ScatterPointLabelStrategy | undefined = undefined
    compareEndPointsOnly: boolean | undefined = undefined
    matchingEntitiesOnly: boolean | undefined = undefined
    /** Hides the total value label that is normally displayed for stacked bar charts */
    hideTotalValueLabel: boolean | undefined = undefined

    missingDataStrategy: MissingDataStrategy | undefined = undefined

    xAxis = new AxisConfig(undefined, this)
    yAxis = new AxisConfig(undefined, this)
    colorScale = new ColorScaleConfig()
    map = new MapConfig()
    dimensions: ChartDimension[] = []
    ySlugs: ColumnSlugs | undefined = undefined
    xSlug: ColumnSlug | undefined = undefined
    colorSlug: ColumnSlug | undefined = undefined
    sizeSlug: ColumnSlug | undefined = undefined
    tableSlugs: ColumnSlugs | undefined = undefined
    selectedEntityColors: {
        [entityName: string]: string | undefined
    } = {}
    selectedEntityNames: EntityName[] = []
    focusedSeriesNames: SeriesName[] = []
    excludedEntityNames: EntityName[] | undefined = undefined
    includedEntityNames: EntityName[] | undefined = undefined
    comparisonLines: ComparisonLineConfig[] | undefined = undefined // todo: Persistables?
    relatedQuestions: RelatedQuestionsConfig[] | undefined = undefined // todo: Persistables?

    dataTableConfig: DataTableConfig = {
        filter: "all",
        search: "",
    }

    /**
     * Used to highlight an entity at a particular time in a line chart.
     * The sparkline in map tooltips makes use of this.
     */
    entityYearHighlight: EntityYearHighlight | undefined = undefined

    hideFacetControl = true

    // the desired faceting strategy, which might not be possible if we change the data
    selectedFacetStrategy: FacetStrategy | undefined = undefined
    sortBy: SortBy | undefined = SortBy.total
    sortOrder: SortOrder | undefined = SortOrder.desc
    sortColumnSlug: string | undefined = undefined
    _isInFullScreenMode = false
    windowInnerWidth: number | undefined = undefined
    windowInnerHeight: number | undefined = undefined
    manuallyProvideData? = false // This will be removed.

    @computed get isDev(): boolean {
        return this.initialOptions.env === "dev"
    }
    isEditor =
        typeof window !== "undefined" && (window as any).isEditor === true
    bakedGrapherURL: string | undefined = undefined
    adminBaseUrl: string | undefined = undefined
    externalQueryParams: QueryParams = {}
    private framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL
    private framePaddingVertical = GRAPHER_FRAME_PADDING_VERTICAL
    _inputTable: OwidTable = new OwidTable()

    // TODO Daniel: probably obsolete?
    // @observable.ref interpolatedSortColumnsBySlug:
    //     | CoreColumnBySlug
    //     | undefined = {}

    get inputTable(): OwidTable {
        return this._inputTable
    }

    set inputTable(table: OwidTable) {
        this._inputTable = table

        if (this.manager?.selection?.hasSelection) {
            // Selection is managed externally, do nothing.
        } else if (this.areSelectedEntitiesDifferentThanAuthors) {
            // User has changed the selection, use theirs
        } else this.applyOriginalSelectionAsAuthored()
    }

    mapRegionDropdownValue: MapRegionDropdownValue | undefined = undefined

    legacyConfigAsAuthored: Partial<LegacyGrapherInterface> = {}
    entitySelectorState: Partial<EntitySelectorState> = {}
    @computed get dataTableSlugs(): ColumnSlug[] {
        return this.tableSlugs ? this.tableSlugs.split(" ") : this.newSlugs
    }
    isEmbeddedInAnOwidPage?: boolean = false
    isEmbeddedInADataPage?: boolean = false

    // This one's explicitly set to `false` if FetchingGrapher or some other
    // external code is fetching the config
    isConfigReady: boolean | undefined = true
    /** Whether external grapher controls can be hidden in embeds. */
    canHideExternalControlsInEmbed: boolean = false

    /**
     * Value of the query parameter in the embed URL that hides external grapher
     * controls.
     */
    hideExternalControlsInEmbedUrl: boolean =
        this.canHideExternalControlsInEmbed

    narrativeChartInfo?: MinimalNarrativeChartInfo = undefined
    archivedChartInfo?: ArchiveContext

    selection: SelectionArray = new SelectionArray()
    focusArray = new FocusArray()
    analytics: GrapherAnalytics

    _additionalDataLoaderFn: AdditionalGrapherDataFetchFn | undefined =
        undefined
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
            entityYearHighlight: observable.ref,
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
            mapRegionDropdownValue: observable,
            legacyConfigAsAuthored: observable.ref,
            entitySelectorState: observable,
            isConfigReady: observable,
            canHideExternalControlsInEmbed: observable.ref,
            hideExternalControlsInEmbedUrl: observable.ref,
            isExportingToSvgOrPng: observable.ref,
            isSocialMediaExport: observable.ref,
            isWikimediaExport: observable.ref,
            variant: observable.ref,
            staticBounds: observable,
            isPlaying: observable.ref,
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
            hideZoomToggle: observable,
            hideNoDataAreaToggle: observable,
            hideFacetYDomainToggle: observable,
            hideXScaleToggle: observable,
            hideYScaleToggle: observable,
            hideMapRegionDropdown: observable,
            forceHideAnnotationFieldsInTitle: observable,
            hasTableTab: observable,
            hideChartTabs: observable,
            hideShareButton: observable,
            hideExploreTheDataButton: observable,
            hideRelatedQuestion: observable,
        })
        // prefer the manager's selection over the config's selectedEntityNames
        // if both are passed in and the manager's selection is not empty.
        // this is necessary for the global entity selector to work correctly.
        if (options.manager?.selection?.hasSelection) {
            this.updateFromObject(_.omit(options, "selectedEntityNames"))
        } else {
            this.updateFromObject(options)
        }

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

        // make sure the static bounds are set
        this.staticBounds = options.staticBounds ?? DEFAULT_GRAPHER_BOUNDS

        this.narrativeChartInfo = options.narrativeChartInfo
        this.archivedChartInfo = options.archivedChartInfo

        this.populateFromQueryParams(
            legacyToCurrentGrapherQueryParams(
                this.initialOptions.queryStr ?? ""
            )
        )
        if (this.isEditor) {
            this.ensureValidConfigWhenEditing()
        }
    }

    toObject(deleteUnchanged: boolean = true): GrapherInterface {
        const obj: GrapherInterface = objectWithPersistablesToObject(
            this,
            grapherKeysToSerialize
        )

        obj.selectedEntityNames = this.selection.selectedEntityNames
        obj.focusedSeriesNames = this.focusArray.seriesNames

        if (deleteUnchanged) {
            deleteRuntimeAndUnchangedProps(obj, defaultObject)
        }

        // always include the schema, even if it's the default
        obj.$schema = this.$schema || latestGrapherConfigSchema

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        if (obj.timelineMinTime)
            obj.timelineMinTime = minTimeToJSON(this.timelineMinTime) as any
        if (obj.timelineMaxTime)
            obj.timelineMaxTime = maxTimeToJSON(this.timelineMaxTime) as any

        // don't serialise tab if the default chart is currently shown
        if (
            this.activeChartType &&
            this.activeChartType === this.defaultChartType
        ) {
            delete obj.tab
        }

        // todo: remove dimensions concept
        // if (this.legacyConfigAsAuthored?.dimensions)
        //     obj.dimensions = this.legacyConfigAsAuthored.dimensions

        return obj
    }

    @action.bound updateFromObject(obj?: GrapherProgrammaticInterface): void {
        if (!obj) return

        updatePersistables(this, obj)

        this.bindUrlToWindow = obj.bindUrlToWindow ?? false

        // Regression fix: some legacies have this set to Null. Todo: clean DB.
        if (obj.originUrl === null) this.originUrl = ""

        // update selection
        if (obj.selectedEntityNames)
            this.selection.setSelectedEntities(obj.selectedEntityNames)

        // update focus
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

        // if a region is specified, show it on the globe
        if (
            obj.map?.region !== undefined &&
            isValidGlobeRegionName(obj.map.region)
        ) {
            this.mapRegionDropdownValue = obj.map.region
            this.globeController.jumpToOwidContinent(obj.map.region)
            this.globeController.showGlobe()
        }

        // Todo: remove once we are more RAII.
        if (obj?.dimensions?.length)
            this.setDimensionsFromConfigs(obj.dimensions)
    }

    @action.bound populateFromQueryParams(params: GrapherQueryParams): void {
        this.externalQueryParams = _.omit(params, GRAPHER_QUERY_PARAM_KEYS)

        // Set tab if specified
        if (params.tab) {
            const tab = this.mapQueryParamToTabName(params.tab)
            if (tab) this.setTab(tab)
            else console.error("Unexpected tab: " + params.tab)
        }

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
                this.activeModal = GrapherModal.Embed
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

        // globe
        const globe = params.globe
        if (globe !== undefined) {
            this.mapConfig.globe.isActive = globe === "1"
        }

        // globe rotation
        const globeRotation = params.globeRotation
        if (globeRotation !== undefined) {
            this.mapConfig.globe.rotation = parseGlobeRotation(globeRotation)
        }

        // globe zoom
        const globeZoom = params.globeZoom
        if (globeZoom !== undefined) {
            const parsedZoom = parseFloatOrUndefined(globeZoom)
            if (parsedZoom !== undefined) this.mapConfig.globe.zoom = parsedZoom
        }

        // region
        const region = params.region
        if (region !== undefined) {
            if (isValidMapRegionName(region)) {
                this.map.region = region
            }

            // show region on the globe
            if (isValidGlobeRegionName(this.map.region)) {
                this.mapRegionDropdownValue = this.map.region
                this.globeController.jumpToOwidContinent(this.map.region)
                this.globeController.showGlobe()
            }
        }

        // map selection
        const mapSelection = getEntityNamesParam(params.mapSelect)
        if (mapSelection) {
            this.mapConfig.selection.setSelectedEntities(mapSelection)
        }

        // selection
        const url = Url.fromQueryParams(params)
        const selection = getSelectedEntityNamesParam(url)
        if (this.addCountryMode !== EntitySelectionMode.Disabled && selection)
            this.selection.setSelectedEntities(selection)

        // focus
        const focusedSeriesNames = getFocusedSeriesNamesParam(params.focus)
        if (focusedSeriesNames) {
            this.focusArray.clearAllAndAdd(...focusedSeriesNames)
        }

        // faceting
        if (params.facet && params.facet in FacetStrategy) {
            this.selectedFacetStrategy = params.facet as FacetStrategy
        }
        if (params.uniformYAxis === "0") {
            this.yAxis.facetDomain = FacetAxisDomain.independent
        } else if (params.uniformYAxis === "1") {
            this.yAxis.facetDomain = FacetAxisDomain.shared
        }

        // no data area in marimekko charts
        if (params.showNoDataArea) {
            this.showNoDataArea = params.showNoDataArea === "1"
        }

        // deprecated; support for legacy URLs
        if (params.showSelectionOnlyInTable) {
            this.dataTableConfig.filter =
                params.showSelectionOnlyInTable === "1" ? "selection" : "all"
        }

        // data table filter
        if (params.tableFilter) {
            this.dataTableConfig.filter = isValidDataTableFilter(
                params.tableFilter
            )
                ? params.tableFilter
                : "all"
        }

        // data table search
        if (params.tableSearch) {
            this.dataTableConfig.search = params.tableSearch
        }
    }

    @action.bound setTimeFromTimeQueryParam(time: string): void {
        this.timelineHandleTimeBounds = getTimeDomainFromQueryString(time).map(
            (time) => findClosestTime(this.times, time) ?? time
        ) as TimeBounds
    }

    @computed private get shouldShowDiscreteBarWhenSingleTime(): boolean {
        let { minTime, maxTime } = this

        if (!this.validChartTypeSet.has(GRAPHER_CHART_TYPES.DiscreteBar))
            return false

        // If we have a time dimension but the timeline is hidden,
        // we always want to use the authored `minTime` and `maxTime`,
        // irrespective of the time range the user might have selected
        // on the table tab
        if (this.hasTimeDimensionButTimelineIsHidden) {
            minTime = this.authorsVersion.minTime
            maxTime = this.authorsVersion.maxTime
        }

        // This is the easy case: minTime and maxTime are the same, no need to do
        // more fancy checks
        if (minTime === maxTime) return true

        // We can have cases where minTime = Infinity and/or maxTime = -Infinity,
        // but still only a single year is selected.
        // To check for that we need to look at the times array.
        const times = this.table.timeColumn.uniqValues
        const closestMinTime = findClosestTime(times, minTime ?? -Infinity)
        const closestMaxTime = findClosestTime(times, maxTime ?? Infinity)
        return closestMinTime !== undefined && closestMinTime === closestMaxTime
    }

    @computed get activeTab(): GrapherTabName {
        const activeTab = this.mapTabConfigOptionToTabName(this.tab)

        // Switch to the discrete bar chart tab if we're on the line or slope
        // chart tab and a single time is selected
        if (
            CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME.includes(
                activeTab as any
            ) &&
            this.shouldShowDiscreteBarWhenSingleTime &&
            // Don't switch to a bar chart while the timeline animation is playing.
            // This is necessary because the time handles are at the same time
            // at the beginning of the timeline animation
            !this.isTimelineAnimationActive
        ) {
            return GRAPHER_TAB_NAMES.DiscreteBar
        }

        return activeTab
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
        // hide the legend for stacked bar charts
        // if the legend only ever shows a single entity
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

    @computed private get hasChartThatShowsAllEntities(): boolean {
        return this.hasScatter || this.hasMarimekko
    }

    @computed get isOnArchivalPage(): boolean {
        return this.archivedChartInfo?.type === "archive-page"
    }

    @computed get hasArchivedPage(): boolean {
        return this.archivedChartInfo?.type === "archived-page-version"
    }

    @computed private get runtimeAssetMap(): AssetMap | undefined {
        return this.archivedChartInfo?.type === "archive-page"
            ? this.archivedChartInfo.assets.runtime
            : undefined
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

    // table that is used for display in the table tab
    @computed get tableForDisplay(): OwidTable {
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
    @computed get tableForSelection(): OwidTable {
        // This table specifies which entities can be selected in the charts EntitySelectorModal.
        // It should contain all entities that can be selected, and none more.
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
            table = table.interpolateColumnWithTolerance(
                this.sizeColumnSlug,
                tolerance
            )
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
                tolerance
            )
        }

        return table
    }

    // If an author sets a timeline or entity filter, run it early in the pipeline
    // so to the charts it's as if the filtered times and entities do not exist
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

    @computed
    get tableAfterAuthorTimelineAndActiveChartTransform(): OwidTable {
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

    @computed get chartState(): ChartState {
        // Note: when timeline handles on a LineChart are collapsed into a single handle, the
        // LineChart turns into a DiscreteBar.

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

    // When Map becomes a first-class chart instance, we should drop this
    @computed get chartStateExceptMap(): ChartState {
        const chartType = this.activeChartType ?? GRAPHER_CHART_TYPES.LineChart

        return makeChartState(chartType, this)
    }

    @computed get chartSeriesNames(): SeriesName[] {
        if (!this.isReady) return []

        // collect series names from all chart instances when faceted
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

    @computed get table(): OwidTable {
        return this.tableAfterAuthorTimelineAndEntityFilter
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

        if (this.isOnDiscreteBarTab || this.isOnMarimekkoTab)
            return table.filterByTargetTimes(
                [endTime],
                table.get(this.yColumnSlugs[0]).tolerance
            )

        if (this.isOnSlopeChartTab)
            return table.filterByTargetTimes(
                [startTime, endTime],
                table.get(this.yColumnSlugs[0]).tolerance
            )

        return table.filterByTimeRange(startTime, endTime)
    }

    @computed get transformedTable(): OwidTable {
        return this.tableAfterAllTransformsAndFilters
    }
    isExportingToSvgOrPng = false
    isSocialMediaExport = false
    isWikimediaExport = false

    variant = GrapherVariant.Default

    staticBounds: Bounds = DEFAULT_GRAPHER_BOUNDS

    enableKeyboardShortcuts: boolean = false
    bindUrlToWindow: boolean = false
    tooltip?: TooltipManager["tooltip"] = observable.box(undefined, {
        deep: false,
    })
    isPlaying = false
    isTimelineAnimationActive = false // true if the timeline animation is either playing or paused but not finished

    animationStartTime: Time | undefined = undefined
    areHandlesOnSameTimeBeforeAnimation: boolean | undefined = undefined
    timelineDragTarget: TimelineDragTarget | undefined = undefined

    isEntitySelectorModalOrDrawerOpen = false

    activeModal?: GrapherModal
    activeDownloadModalTab: DownloadModalTabName = DownloadModalTabName.Vis

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

    @computed get isAdminObjectAvailable(): boolean {
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

    @computed get isUserLoggedInAsAdmin(): boolean {
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

    @action.bound applyOriginalSelectionAsAuthored(): void {
        if (this.selectedEntityNames?.length)
            this.selection.setSelectedEntities(this.selectedEntityNames)
    }
    // The below properties are here so the admin can access them

    @computed get hasData(): boolean {
        return this.dimensions.length > 0 || this.newSlugs.length > 0
    }
    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady(): boolean {
        if (!this.isConfigReady) return false
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
    set startHandleTimeBound(newValue: TimeBound) {
        if (this.isSingleTimeSelectionActive)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                newValue,
                this.timelineHandleTimeBounds[1],
            ]
    }

    set endHandleTimeBound(newValue: TimeBound) {
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
    @action.bound resetHandleTimeBounds(): void {
        this.startHandleTimeBound = this.timelineMinTime ?? -Infinity
        this.endHandleTimeBound = this.timelineMaxTime ?? Infinity
    }

    // Keeps a running cache of series colors at the Grapher level.
    seriesColorMap: SeriesColorMap = new Map()

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

    @computed private get onlySingleTimeSelectionPossible(): boolean {
        return this.checkOnlySingleTimeSelectionPossible(this.activeTab)
    }

    @computed private get isSingleTimeSelectionActive(): boolean {
        return (
            this.onlySingleTimeSelectionPossible ||
            this.isSingleTimeScatterAnimationActive
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
    @computed.struct private get variableIds(): number[] {
        return _.uniq(this.dimensions.map((d) => d.variableId))
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
    disposers: (() => void)[] = []

    @bind dispose(): void {
        this.disposers.forEach((dispose) => dispose())
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
            "WorldMap",
            "DiscreteBar",
            "StackedDiscreteBar",
            "Marimekko",
        ].includes(tabName)
    }

    private checkStartAndEndTimeSelectionPreferred = (
        tabName: GrapherTabName
    ): boolean => {
        return [
            "LineChart",
            "SlopeChart",
            "StackedArea",
            "StackedBar",
        ].includes(tabName)
    }

    @action.bound ensureTimeHandlesAreSensibleForTab(
        tab: GrapherTabName
    ): void {
        if (this.checkOnlySingleTimeSelectionPossible(tab)) {
            this.ensureHandlesAreOnSameTime()
        } else if (this.checkStartAndEndTimeSelectionPreferred(tab)) {
            this.ensureHandlesAreOnDifferentTimes()
        }
    }

    @action.bound onChartSwitching(
        _oldTab: GrapherTabName,
        newTab: GrapherTabName
    ): void {
        this.ensureTimeHandlesAreSensibleForTab(newTab)
    }

    @action.bound syncEntitySelectionBetweenChartAndMap(
        oldTab: GrapherTabName,
        newTab: GrapherTabName
    ): void {
        // sync entity selection between the map and the chart tab if entity
        // selection is enabled for the map, and the map has been interacted
        // with, i.e. at least one country has been selected on the map
        const shouldSyncSelection =
            this.addCountryMode !== EntitySelectionMode.Disabled &&
            this.isMapSelectionEnabled &&
            this.mapConfig.selection.hasSelection

        // switching from the chart tab to the map tab
        if (isChartTab(oldTab) && isMapTab(newTab) && shouldSyncSelection) {
            this.mapConfig.selection.setSelectedEntities(
                this.selection.selectedEntityNames
            )
        }

        // switching from the map tab to the chart tab
        if (isMapTab(oldTab) && isChartTab(newTab) && shouldSyncSelection) {
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

            // the map and chart tab might have a different set of sort columns;
            // if the currently selected sort column is invalid, reset it to the default
            const sortSlug = entitySelector.sortConfig.slug
            if (!entitySelector.isSortSlugValid(sortSlug)) {
                this.entitySelectorState.sortConfig =
                    entitySelector.getDefaultSortConfig()
            }

            // the map and chart tab might have a different set of entity filters;
            // if the currently selected entity filter is invalid, reset it
            const { entityFilter } = this.entitySelectorState
            if (entityFilter) {
                if (!this.entitySelector.isEntityFilterValid(entityFilter)) {
                    this.entitySelectorState.entityFilter = undefined
                }
            }

            // the map column slug might be interpolated with different
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

    // todo: can we remove this?
    // I believe these states can only occur during editing.
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

    // todo: do we need this?
    @computed get originUrlWithProtocol(): string {
        if (!this.originUrl) return ""
        let url = this.originUrl
        if (!url.startsWith("http")) url = `https://${url}`
        return url
    }
    @computed get timelineHandleTimeBounds(): TimeBounds {
        if (this.isOnMapTab) {
            const time = maxTimeBoundFromJSONOrPositiveInfinity(this.map.time)
            return [time, time]
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
    @computed get displaySlug(): string {
        return this.slug ?? slugify(this.displayTitle)
    }
    shouldIncludeDetailsInStaticExport = true
    // Used for superscript numbers in static exports
    @computed get detailsOrderedByReference(): string[] {
        if (typeof window === "undefined") return []

        // extract details from supporting text
        const subtitleDetails = !this.hideSubtitle
            ? extractDetailsFromSyntax(this.currentSubtitle)
            : []
        const noteDetails = !this.hideNote
            ? extractDetailsFromSyntax(this.note ?? "")
            : []

        // extract details from axis labels
        const yAxisDetails = extractDetailsFromSyntax(
            this.yAxisConfig.label || ""
        )
        const xAxisDetails = extractDetailsFromSyntax(
            this.xAxisConfig.label || ""
        )

        // text fragments are ordered by appearance
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

    // Used for static exports. Defined at this level because they need to
    // be accessed by CaptionedChart and DownloadModal
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

            // can't use the computed property here because Grapher might not currently be in static mode
            const baseFontSize = this.areStaticBoundsSmall
                ? this.computeBaseFontSizeFromHeight(this.staticBounds)
                : 18

            return new MarkdownTextWrap({
                text,
                fontSize: (11 / BASE_FONT_SIZE) * baseFontSize,
                // leave room for padding on the left and right
                maxWidth:
                    this.staticBounds.width - 2 * this.framePaddingHorizontal,
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

        // all single-chart Graphers are valid
        if (chartTypeSet.size <= 1) return Array.from(chartTypeSet)

        // find valid combination in a pre-defined list
        const validChartTypes = findValidChartTypeCombination(
            Array.from(chartTypeSet)
        )

        // if the given combination is not valid, then ignore all but the first chart type
        if (!validChartTypes) return this.chartTypes.slice(0, 1)

        // projected data is only supported for line charts
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
        if (!this.hideChartTabs) availableTabs.push(...this.validChartTypes)
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
                    // chart types that refer to the current time only in the timeline
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

        // helper function to add an annotation fragment to the title
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
        // we don't have more than one distinct time point in our data, so it doesn't make sense to show a timeline
        if (this.times.length <= 1) return false

        switch (this.activeTab) {
            // the map tab has its own `hideTimeline` option
            case GRAPHER_TAB_NAMES.WorldMap:
                return !this.map.hideTimeline

            // use the chart-level `hideTimeline` option for the table, with some exceptions
            case GRAPHER_TAB_NAMES.Table:
                // always show the timeline for charts that plot time on the x-axis
                if (this.hasTimeDimension) return true
                return !this.hideTimeline

            // use the chart-level `hideTimeline` option
            default:
                return !this.hideTimeline
        }
    }

    @computed private get areHandlesOnSameTime(): boolean {
        const times = this.table.timeColumn.uniqValues
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

    @computed get yScaleType(): ScaleType | undefined {
        return this.yAxis.scaleType
    }
    @computed get xScaleType(): ScaleType | undefined {
        return this.xAxis.scaleType
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

    set facetStrategy(facet: FacetStrategy) {
        this.selectedFacetStrategy = facet
    }
    set baseFontSize(val: number) {
        this._baseFontSize = val
    }

    getColumnSlugsForCondensedSources(): string[] {
        const { xColumnSlug, sizeColumnSlug, colorColumnSlug, hasMarimekko } =
            this
        const columnSlugs: string[] = []

        // exclude "Countries Continent" if it's used as the color dimension in a scatter plot, slope chart etc.
        if (
            colorColumnSlug !== undefined &&
            !isContinentsVariableId(colorColumnSlug)
        )
            columnSlugs.push(colorColumnSlug)

        if (xColumnSlug !== undefined) {
            const xColumn = this.inputTable.get(xColumnSlug)
                .def as OwidColumnDef
            // exclude population variable if it's used as the x dimension in a marimekko
            if (
                !hasMarimekko ||
                !isPopulationVariableETLPath(xColumn?.catalogPath ?? "")
            )
                columnSlugs.push(xColumnSlug)
        }

        // exclude population variable if it's used as the size dimension in a scatter plot
        if (sizeColumnSlug !== undefined) {
            const sizeColumn = this.inputTable.get(sizeColumnSlug)
                .def as OwidColumnDef
            if (!isPopulationVariableETLPath(sizeColumn?.catalogPath ?? ""))
                columnSlugs.push(sizeColumnSlug)
        }
        return columnSlugs
    }
    @computed get columnsWithSourcesCondensed(): CoreColumn[] {
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
    // Returns an object ready to be serialized to JSON
    @computed get object(): GrapherInterface {
        return this.toObject()
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
    @computed get xDimension(): ChartDimension | undefined {
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
    @computed get defaultBounds(): Bounds {
        return new Bounds(0, 0, DEFAULT_GRAPHER_WIDTH, DEFAULT_GRAPHER_HEIGHT)
    }
    @computed get hasYDimension(): boolean {
        return this.dimensions.some((d) => d.property === DimensionProperty.y)
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
                2 * this.framePaddingVertical +
                sumTextWrapHeights(
                    this.detailRenderers,
                    STATIC_EXPORT_DETAIL_SPACING
                )
        }

        return new Bounds(0, 0, this.staticBounds.width, height)
    }

    rasterize(): Promise<GrapherExport> {
        const { width, height } = this.staticBoundsWithDetails

        // We need to ensure `rasterize` is only called on the client-side, otherwise this will fail
        const staticSVG = this.generateStaticSvg(reactRenderToStringClientOnly)

        return new StaticChartRasterizer(staticSVG, width, height).render()
    }
    @computed get disableIntroAnimation(): boolean {
        return this.isStatic
    }
    @computed get mapConfig(): MapConfig {
        return this.map
    }
    @computed get cacheTag(): string {
        return this.version.toString()
    }

    @computed get relativeToggleLabel(): string {
        if (this.isOnScatterTab) return "Display average annual change"
        else if (this.isOnLineChartTab || this.isOnSlopeChartTab)
            return "Display relative change"
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

        // actually trying to exclude relative mode with just one metric or entity
        if (
            hasSingleEntityInFacets ||
            hasSingleMetricInFacets ||
            isStackedChartSplitByMetric
        )
            return false

        if (isOnMarimekkoTab && xColumnSlug === undefined) return false
        return !hideRelativeToggle
    }

    // Filter data to what can be display on the map (across all times)
    @computed get mappableData(): OwidVariableRow<any>[] {
        return this.inputTable
            .get(this.mapColumnSlug)
            .owidRows.filter((row) => isOnTheMap(row.entityName))
    }
    @computed get isMobile(): boolean {
        return isMobile()
    }
    @computed get isTouchDevice(): boolean {
        return isTouchDevice()
    }
    _externalBounds: Bounds | undefined = undefined
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
        // hide the full screen button if the full screen height
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
        // if there's no panel, the chart takes up the whole frame
        if (!this.isEntitySelectorPanelActive) return this.frameBounds

        return new Bounds(
            0,
            0,
            // the chart takes up 9 columns in 12-column grid
            (9 / 12) * this.frameBounds.width,
            this.frameBounds.height - 2 // 2px accounts for the border
        )
    }

    /** Bounds of the chart area if no CaptionedChart is rendered */
    @computed get chartAreaBounds(): Bounds {
        // 2px accounts for the border
        return this.activeBounds.pad(2)
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

    base = React.createRef<HTMLDivElement>()
    @computed get containerElement(): HTMLDivElement | undefined {
        return this.base.current || undefined
    }

    // private hasLoggedGAViewEvent = false
    // @observable private hasBeenVisible = false
    // @observable private uncaughtError?: Error

    @computed private get analyticsContext(): GrapherAnalyticsContext {
        const ctx = this.manager?.analyticsContext
        return {
            slug: ctx?.mdimSlug ?? this.slug,
            mdimView: ctx?.mdimView,
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

    // @action.bound setError(err: Error): void {
    //     this.uncaughtError = err
    // }

    // @action.bound clearErrors(): void {
    //     this.uncaughtError = undefined
    // }

    // private get commandPalette(): React.ReactElement | null {
    //     return this.props.enableKeyboardShortcuts ? (
    //         <CommandPalette commands={this.keyboardShortcuts} display="none" />
    //     ) : null
    // }

    formatTimeFn(time: Time): string {
        return this.inputTable.timeColumn.formatTime(time)
    }
    @computed get availableEntityNames(): EntityName[] {
        return this.tableForSelection.availableEntityNames
    }
    @computed get entityRegionTypeGroups(): EntityRegionTypeGroup[] {
        return groupEntityNamesByRegionType(this.table.availableEntityNames)
    }

    @computed get entityNamesByRegionType(): EntityNamesByRegionType {
        return new Map(
            this.entityRegionTypeGroups.map(({ regionType, entityNames }) => [
                regionType,
                entityNames,
            ])
        )
    }
    slideShow: SlideShowController<any> | undefined = undefined
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
    // issue #2136 describes a serious bug that relates to relative mode and
    // affects all stacked area/bar charts that are split by metric. for now,
    // we simply turn off relative mode in such cases. once the bug is properly
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
    // the actual facet setting used by a chart, potentially overriding selectedFacetStrategy
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
            this.isEntitySelectorModalOrDrawerOpen = false
            this.activeModal = undefined
            this.isShareMenuActive = false
        } else {
            this.isInFullScreenMode = false
        }
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
            // Chart is published (this is false for charts inside explorers, for example)
            !!this.isPublished &&
            // We're not on an archival grapher page
            !this.isOnArchivalPage &&
            // We're not inside the admin
            window.admin === undefined &&
            // The slug is set
            !!this.slug &&
            !this.narrativeChartInfo // We're not in a narrative chart
        )
    }
    _baseFontSize = BASE_FONT_SIZE
    @computed get baseFontSize(): number {
        if (this.isStaticAndSmall) {
            return this.computeBaseFontSizeFromHeight(this.staticBounds)
        }
        if (this.isStatic) return 18
        return this._baseFontSize
    }
    // the header and footer don't rely on the base font size unless explicitly specified
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
    // Small charts are rendered into 6 or 7 columns in a 12-column grid layout
    // (e.g. side-by-side charts or charts in the All Charts block)
    @computed get isSmall(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 740
    }
    // Medium charts are rendered into 8 columns in a 12-column grid layout
    // (e.g. stand-alone charts in the main text of an article)
    @computed get isMedium(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 845
    }

    @computed get isStaticAndSmall(): boolean {
        if (!this.isStatic) return false
        return this.areStaticBoundsSmall
    }
    @computed get areStaticBoundsSmall(): boolean {
        const { defaultBounds, staticBounds } = this
        const idealPixelCount = defaultBounds.width * defaultBounds.height
        const staticPixelCount = staticBounds.width * staticBounds.height
        return staticPixelCount < 0.66 * idealPixelCount
    }

    @computed get isExportingForSocialMedia(): boolean {
        return (
            this.isExportingToSvgOrPng &&
            this.isStaticAndSmall &&
            this.isSocialMediaExport
        )
    }

    @computed get isExportingForWikimedia(): boolean {
        return this.isExportingToSvgOrPng && this.isWikimediaExport
    }

    @computed get backgroundColor(): Color {
        return this.isExportingForSocialMedia
            ? GRAPHER_BACKGROUND_BEIGE
            : GRAPHER_BACKGROUND_DEFAULT
    }

    @computed get shouldPinTooltipToBottom(): boolean {
        return this.isTouchDevice
    }

    isShareMenuActive = false
    @computed get hasRelatedQuestion(): boolean {
        if (
            this.hideRelatedQuestion ||
            !this.relatedQuestions ||
            !this.relatedQuestions.length
        )
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
    @action.bound clearFocus(): void {
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
        this.map.region = authorsVersion.map.region
        this.showNoDataArea = authorsVersion.showNoDataArea
        this.dataTableConfig.filter = authorsVersion.dataTableConfig.filter
        this.dataTableConfig.search = authorsVersion.dataTableConfig.search
        this.mapConfig.globe.isActive = authorsVersion.mapConfig.globe.isActive
        this.clearSelection()
        this.clearFocus()
        this.mapConfig.selection.clearSelection()
    }
    // Todo: come up with a more general pattern?
    // The idea here is to reset the Grapher to a blank slate, so that if you updateFromObject and the object contains some blanks, those blanks
    // won't overwrite defaults (like type == LineChart). RAII would probably be better, but this works for now.
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

    debounceMode: boolean = false

    @computed.struct get allParams(): GrapherQueryParams {
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
            .with(GrapherModal.Embed, () => "embed")
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

    // Autocomputed url params to reflect difference between current grapher state
    // and original config state
    @computed.struct get changedParams(): Partial<GrapherQueryParams> {
        return differenceObj(this.allParams, this.authorsVersion.allParams)
    }

    // If you want to compare current state against the published grapher.
    @computed get authorsVersion(): GrapherState {
        return new GrapherState({
            ...this.legacyConfigAsAuthored,
            manager: undefined,
            queryStr: "",
        })
    }

    @computed get queryStr(): string {
        return queryParamsToStr({
            ...this.changedParams,
            ...this.externalQueryParams,
        })
    }
    @computed get baseUrl(): string | undefined {
        if (this.isOnArchivalPage) return this.archivedChartInfo?.archiveUrl

        return this.isPublished
            ? `${this.bakedGrapherURL ?? "/grapher"}/${this.displaySlug}`
            : undefined
    }
    readonly manager: GrapherManager | undefined = undefined
    @computed get canonicalUrlIfIsNarrativeChart(): string | undefined {
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
    // Get the full url representing the canonical location of this grapher state
    @computed get canonicalUrl(): string | undefined {
        return (
            this.manager?.canonicalUrl ??
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

    @computed get embedUrl(): string | undefined {
        const url = this.canonicalUrl
        if (!url) return

        // We want to preserve the tab in the embed URL so that if we change the
        // default view of the chart, it won't change existing embeds.
        // See https://github.com/owid/owid-grapher/issues/2805
        let urlObj = Url.fromURL(url)
        if (!urlObj.queryParams.tab) {
            urlObj = urlObj.updateQueryParams({ tab: this.allParams.tab })
        }
        if (this.canHideExternalControlsInEmbed) {
            urlObj = urlObj.updateQueryParams({
                hideControls: this.hideExternalControlsInEmbedUrl.toString(),
            })
        }
        return urlObj.fullUrl
    }

    @computed get embedArchivedUrl(): string | undefined {
        if (!this.archivedChartInfo) return undefined
        return this.archivedChartInfo.archiveUrl + this.queryStr
    }

    @computed get hasUserChangedTimeHandles(): boolean {
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
    globeController = new GlobeController(this)

    private dismissTooltip(): void {
        const tooltip = this.tooltip?.get()
        if (tooltip) tooltip.dismiss?.()
    }

    @action.bound onTimelineClick(): void {
        this.dismissTooltip()
    }

    @action.bound onMapCountryDropdownFocus(): void {
        this.dismissTooltip()
    }

    @action.bound resetMapRegionDropdown(): void {
        this.mapRegionDropdownValue = undefined
    }

    // called when an entity is selected in the entity selector
    @action.bound onSelectEntity(entityName: EntityName): void {
        const { selectedCountryNamesInForeground } = this.mapConfig.selection
        if (
            this.isOnMapTab &&
            this.isMapSelectionEnabled &&
            this.mapConfig.globe.isActive
        ) {
            const region = getRegionByName(entityName)
            if (region) {
                if (
                    checkIsCountry(region) &&
                    region.isMappable &&
                    selectedCountryNamesInForeground.includes(region.name)
                ) {
                    // rotate to the selected country
                    this.globeController.focusOnCountry(region.name)
                } else if (checkIsOwidContinent(region)) {
                    // rotate to the selected owid continent
                    this.globeController.rotateToOwidContinent(
                        MAP_REGION_NAMES[region.name] as GlobeRegionName
                    )
                } else if (checkIsIncomeGroup(region)) {
                    // switch back to the map
                    this.globeController.hideGlobe()
                } else if (checkHasMembers(region)) {
                    // rotate to the selected region
                    this.globeController.rotateToRegion(region.name)
                }
            }
        }

        this.resetMapRegionDropdown()
    }

    // called when an entity is deselected in the entity selector
    @action.bound onDeselectEntity(entityName: EntityName): void {
        // Remove focus from an entity that has been removed from the selection
        this.focusArray.remove(entityName)

        // Remove focus from the deselected country
        this.globeController.dismissCountryFocus()

        this.resetMapRegionDropdown()
    }

    // called when all entities are cleared in the entity selector
    @action.bound onClearEntities(): void {
        // remove focus from all entities if all entities have been deselected
        this.focusArray.clear()

        // switch back to the 2d map if all entities were deselected
        if (this.isOnMapTab) this.globeController.hideGlobe()

        this.resetMapRegionDropdown()
    }

    isEntityMutedInSelector(entityName: EntityName): boolean {
        // for now, muted entities are only relevant on the map tab
        if (!this.isOnMapTab) return false

        // entities disabled on the map are muted
        return this.mapConfig.selection.selectedCountryNamesInBackground.includes(
            entityName
        )
    }

    // todo: restore this behavior??
    onStartPlayOrDrag(): void {
        this.debounceMode = true
    }

    onStopPlayOrDrag(): void {
        this.debounceMode = false
    }
    @computed get disablePlay(): boolean {
        return false
    }

    @computed get animationEndTime(): Time {
        const { timeColumn } = this.table
        if (this.timelineMaxTime) {
            return (
                findClosestTime(timeColumn.uniqValues, this.timelineMaxTime) ??
                timeColumn.maxTime
            )
        }
        return timeColumn.maxTime
    }

    formatTime(value: Time): string {
        const timeColumn = this.table.timeColumn
        return isMobile()
            ? timeColumn.formatValueForMobile(value)
            : timeColumn.formatValue(value)
    }
    @computed get canSelectMultipleEntities(): boolean {
        if (this.isOnMapTab) return true

        if (this.numSelectableEntityNames < 2) return false
        if (this.addCountryMode === EntitySelectionMode.MultipleEntities)
            return true

        // if the chart is currently faceted by entity, then use multi-entity
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
            // don't use the panel if the grapher is embedded
            ((!this.isInIFrame && !this.isEmbeddedInAnOwidPage) ||
                // unless we're in full-screen mode
                this.isInFullScreenMode)
        )
            return GrapherWindowType.panel

        return this.isSemiNarrow
            ? GrapherWindowType.modal
            : GrapherWindowType.drawer
    }

    @computed get isEntitySelectorPanelActive(): boolean {
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
            // only show the entity selector on the map tab if it's rendered
            // into the side panel or into the slide-in drawer
            this.shouldShowEntitySelectorAs !== GrapherWindowType.modal
        )
    }

    // This is just a helper method to return the correct table for providing entity choices. We want to
    // provide the root table, not the transformed table.
    // A user may have added time or other filters that would filter out all rows from certain entities, but
    // we may still want to show those entities as available in a picker. We also do not want to do things like
    // hide the Add Entity button as the user drags the timeline.
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

    hideTitle = false
    hideSubtitle = false
    hideNote = false
    hideOriginUrl = false

    // For now I am only exposing this programmatically for the dashboard builder. Setting this to true
    // allows you to still use add country "modes" without showing the buttons in order to prioritize
    // another entity selector over the built in ones.
    hideEntityControls = false

    enableMapSelection = false

    // exposed programmatically for hiding interactive controls or tabs when desired
    // (e.g. used to hide Grapher chrome when a Grapher chart in a Gdoc article is in "read-only" mode)
    hideZoomToggle = false
    hideNoDataAreaToggle = false
    hideFacetYDomainToggle = false
    hideXScaleToggle = false
    hideYScaleToggle = false
    hideMapRegionDropdown = false
    // enforces hiding an annotation, even if that means that a crucial piece of information is missing from the chart title
    forceHideAnnotationFieldsInTitle: AnnotationFieldsInTitle = {
        entity: false,
        time: false,
        changeInPrefix: false,
    }
    hasTableTab = true
    hideChartTabs = false
    hideShareButton = false
    hideExploreTheDataButton = true
    hideRelatedQuestion = false

    initialOptions: GrapherProgrammaticInterface
}

export interface GrapherProps {
    grapherState: GrapherState
}

@observer
export class Grapher extends React.Component<GrapherProps> {
    @computed get grapherState(): GrapherState {
        return this.props.grapherState
    }

    // #region Observable props not in any interface

    // stored on Grapher so state is preserved when switching to full-screen mode

    private legacyVariableDataJson:
        | MultipleOwidVariableDataDimensionsMap
        | undefined = undefined
    private hasLoggedGAViewEvent = false
    private hasBeenVisible = false
    private uncaughtError: Error | undefined = undefined

    constructor(props: { grapherState: GrapherState }) {
        super(props)

        makeObservable<
            Grapher,
            "legacyVariableDataJson" | "hasBeenVisible" | "uncaughtError"
        >(this, {
            legacyVariableDataJson: observable,
            hasBeenVisible: observable,
            uncaughtError: observable,
        })
    }

    // Convenience method for debugging
    windowQueryParams(str = location.search): QueryParams {
        return strToQueryParams(str)
    }

    @action.bound private _setInputTable(
        json: MultipleOwidVariableDataDimensionsMap,
        legacyConfig: Partial<LegacyGrapherInterface>
    ): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files

        const startMark = performance.now()
        const tableWithColors = legacyToOwidTableAndDimensionsWithMandatorySlug(
            json,
            legacyConfig.dimensions ?? [],
            legacyConfig.selectedEntityColors
        )
        this.grapherState.createPerformanceMeasurement(
            "legacyToOwidTableAndDimensions",
            startMark
        )

        this.grapherState.inputTable = tableWithColors
    }

    @action rebuildInputOwidTable(): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files
        if (!this.legacyVariableDataJson) return
        this._setInputTable(
            this.legacyVariableDataJson,
            this.grapherState.legacyConfigAsAuthored
        )
    }

    // Keeps a running cache of series colors at the Grapher level.

    @bind dispose(): void {
        this.grapherState.disposers.forEach((dispose) => dispose())
    }

    @action.bound setError(err: Error): void {
        this.uncaughtError = err
    }

    @action.bound clearErrors(): void {
        this.uncaughtError = undefined
    }

    private get commandPalette(): React.ReactElement | null {
        return this.props.grapherState.enableKeyboardShortcuts ? (
            <CommandPalette commands={this.keyboardShortcuts} display="none" />
        ) : null
    }

    @action.bound private toggleTabCommand(): void {
        this.grapherState.setTab(
            next(this.grapherState.availableTabs, this.grapherState.activeTab)
        )
    }

    @action.bound private togglePlayingCommand(): void {
        void this.grapherState.timelineController.togglePlay()
    }

    private get keyboardShortcuts(): Command[] {
        const temporaryFacetTestCommands = _.range(0, 10).map((num) => {
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
                fn: (): void => {
                    if (this.grapherState.selection.hasSelection) {
                        this.grapherState.selection.clearSelection()
                        this.grapherState.focusArray.clear()
                    } else {
                        this.grapherState.selection.setSelectedEntities(
                            this.grapherState.availableEntityNames
                        )
                    }
                },
                title: this.grapherState.selection.hasSelection
                    ? `Select None`
                    : `Select All`,
                category: "Selection",
            },
            {
                combo: "f",
                fn: (): void => {
                    this.grapherState.hideFacetControl =
                        !this.grapherState.hideFacetControl
                },
                title: `Toggle Faceting`,
                category: "Chart",
            },
            {
                combo: "p",
                fn: (): void => this.togglePlayingCommand(),
                title: this.grapherState.isPlaying ? `Pause` : `Play`,
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
                    const isSourcesModalOpen =
                        this.grapherState.activeModal === GrapherModal.Sources
                    this.grapherState.activeModal = isSourcesModalOpen
                        ? undefined
                        : GrapherModal.Sources
                },
                title: `Toggle sources modal`,
                category: "Chart",
            },
            {
                combo: "d",
                fn: (): void => {
                    const isDownloadModalOpen =
                        this.grapherState.activeModal === GrapherModal.Download
                    this.grapherState.activeModal = isDownloadModalOpen
                        ? undefined
                        : GrapherModal.Download
                },
                title: "Toggle download modal",
                category: "Chart",
            },
            { combo: "esc", fn: (): void => this.clearErrors() },
            {
                combo: "z",
                fn: (): void => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "shift+o",
                fn: (): void => this.grapherState.clearQueryParams(),
                title: "Reset to original",
                category: "Navigation",
            },
            {
                combo: "g",
                fn: (): void => this.grapherState.globeController.toggleGlobe(),
                title: "Toggle globe view",
                category: "Map",
            },
        ]

        if (this.grapherState.slideShow) {
            const slideShow = this.grapherState.slideShow
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

    @action.bound private toggleTimelineCommand(): void {
        // Todo: add tests for this
        this.grapherState.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.grapherState.timeParam!)
        )
    }

    @action.bound private toggleYScaleTypeCommand(): void {
        this.grapherState.yAxis.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.grapherState.yAxis.scaleType
        )
    }

    @action.bound randomSelection(num: number): void {
        // Continent, Population, GDP PC, GDP, PopDens, UN, Language, etc.
        this.clearErrors()
        const currentSelection =
            this.grapherState.selection.selectedEntityNames.length
        const newNum = num ? num : currentSelection ? currentSelection * 2 : 10
        this.grapherState.selection.setSelectedEntities(
            sampleFrom(
                this.grapherState.availableEntityNames,
                newNum,
                Date.now()
            )
        )
    }
    @action.bound toggleFullScreenMode(): void {
        this.grapherState.isInFullScreenMode =
            !this.grapherState.isInFullScreenMode
    }

    @action.bound dismissFullScreen(): void {
        // if a modal is open, dismiss it instead of exiting full-screen mode
        if (
            this.grapherState.isModalOpen ||
            this.grapherState.isShareMenuActive
        ) {
            this.grapherState.isEntitySelectorModalOrDrawerOpen = false
            this.grapherState.activeModal = undefined
            this.grapherState.isShareMenuActive = false
        } else {
            this.grapherState.isInFullScreenMode = false
        }
    }

    private renderError(): React.ReactElement {
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
                    padding: "48px",
                }}
            >
                <p style={{ color: "#cc0000", fontWeight: 700 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    There was a problem loading this chart
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

    private renderGrapherComponent(): React.ReactElement {
        const containerClasses = classnames({
            GrapherComponent: true,
            GrapherPortraitClass: this.grapherState.isPortrait,
            isStatic: this.grapherState.isStatic,
            isExportingToSvgOrPng: this.grapherState.isExportingToSvgOrPng,
            GrapherComponentNarrow: this.grapherState.isNarrow,
            GrapherComponentSemiNarrow: this.grapherState.isSemiNarrow,
            GrapherComponentSmall: this.grapherState.isSmall,
            GrapherComponentMedium: this.grapherState.isMedium,
        })

        const containerStyle = {
            width: this.grapherState.activeBounds.width,
            height: this.grapherState.activeBounds.height,
            fontSize: this.grapherState.isExportingToSvgOrPng
                ? 18
                : Math.min(16, this.grapherState.fontSize), // cap font size at 16px
        }

        return (
            <div
                ref={this.grapherState.base}
                className={containerClasses}
                style={containerStyle}
                data-grapher-url={JSON.stringify({
                    grapherUrl: this.grapherState.canonicalUrl,
                    narrativeChartName:
                        this.grapherState.narrativeChartInfo?.name,
                })}
            >
                {this.commandPalette}
                {this.uncaughtError ? this.renderError() : this.renderReady()}
            </div>
        )
    }

    override render(): React.ReactElement | undefined {
        // Used in the admin to render a static preview of the chart
        if (this.grapherState.isExportingToSvgOrPng)
            return <Chart manager={this.grapherState} />

        if (this.grapherState.isInFullScreenMode) {
            return (
                <FullScreen
                    onDismiss={this.dismissFullScreen}
                    overlayColor={
                        this.grapherState.isModalOpen ? "#999999" : "#fff"
                    }
                >
                    {this.renderGrapherComponent()}
                </FullScreen>
            )
        }

        return this.renderGrapherComponent()
    }

    private renderReady(): React.ReactElement | null {
        if (!this.hasBeenVisible) return null

        const entitySelectorArray = this.grapherState.isOnMapTab
            ? this.grapherState.mapConfig.selection
            : this.grapherState.selection

        return (
            <>
                {/* Chart and entity selector */}
                <div className="CaptionedChartAndSidePanel">
                    <Chart manager={this.grapherState} />

                    {this.grapherState.sidePanelBounds && (
                        <SidePanel bounds={this.grapherState.sidePanelBounds}>
                            <EntitySelector
                                manager={this.grapherState}
                                selection={entitySelectorArray}
                            />
                        </SidePanel>
                    )}
                </div>

                {/* Modals */}
                {this.grapherState.activeModal === GrapherModal.Sources &&
                    this.grapherState.isReady && (
                        <SourcesModal manager={this.grapherState} />
                    )}
                {this.grapherState.activeModal === GrapherModal.Download &&
                    this.grapherState.isReady && (
                        <DownloadModal manager={this.grapherState} />
                    )}
                {this.grapherState.activeModal === GrapherModal.Embed &&
                    this.grapherState.isReady && (
                        <EmbedModal manager={this.grapherState} />
                    )}
                {this.grapherState.isEntitySelectorModalOpen && (
                    <EntitySelectorModal manager={this.grapherState} />
                )}

                {/* Entity selector in a slide-in drawer */}
                <SlideInDrawer
                    grapherRef={this.grapherState.base}
                    active={this.grapherState.isEntitySelectorDrawerOpen}
                    toggle={() => {
                        this.grapherState.isEntitySelectorModalOrDrawerOpen =
                            !this.grapherState.isEntitySelectorModalOrDrawerOpen
                    }}
                >
                    <EntitySelector
                        manager={this.grapherState}
                        selection={entitySelectorArray}
                        autoFocus={true}
                    />
                </SlideInDrawer>

                {/* Tooltip: either pin to the bottom or render into the chart area */}
                {this.grapherState.shouldPinTooltipToBottom ? (
                    <BodyDiv>
                        <TooltipContainer
                            tooltipProvider={this.grapherState}
                            anchor={GrapherTooltipAnchor.bottom}
                        />
                    </BodyDiv>
                ) : (
                    <TooltipContainer
                        tooltipProvider={this.grapherState}
                        containerWidth={
                            this.grapherState.captionedChartBounds.width
                        }
                        containerHeight={
                            this.grapherState.captionedChartBounds.height
                        }
                    />
                )}
            </>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound private setUpIntersectionObserver(): void {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            // We need to render this immediately to avoid a Safari bug, where Safari
                            // is seemingly blocking rendering during the initial fetches, and will then
                            // subsequently render using the wrong bounds.
                            flushSync(() => {
                                this.hasBeenVisible = true
                            })

                            if (!this.hasLoggedGAViewEvent) {
                                this.hasLoggedGAViewEvent = true

                                if (this.grapherState.narrativeChartInfo) {
                                    this.grapherState.analytics.logGrapherView(
                                        this.grapherState.narrativeChartInfo
                                            .parentChartSlug,
                                        {
                                            narrativeChartName:
                                                this.grapherState
                                                    .narrativeChartInfo.name,
                                        }
                                    )
                                    this.hasLoggedGAViewEvent = true
                                } else if (this.grapherState.slug) {
                                    this.grapherState.analytics.logGrapherView(
                                        this.grapherState.slug
                                    )
                                    this.hasLoggedGAViewEvent = true
                                }
                            }

                            // dismiss tooltip when less than 2/3 of the chart is visible
                            const tooltip = this.grapherState.tooltip?.get()
                            const isNotVisible = !entry.isIntersecting
                            const isPartiallyVisible =
                                entry.isIntersecting &&
                                entry.intersectionRatio < 0.66
                            if (
                                tooltip &&
                                (isNotVisible || isPartiallyVisible)
                            ) {
                                tooltip.dismiss?.()
                            }
                        }
                    })
                },
                { threshold: [0, 0.66] }
            )
            observer.observe(this.grapherState.containerElement!)
            this.grapherState.disposers.push(() => observer.disconnect())
        } else {
            // IntersectionObserver not available; we may be in a Node environment, just render
            this.hasBeenVisible = true
        }
    }
    @action.bound private setBaseFontSize(): void {
        this.grapherState.baseFontSize =
            this.grapherState.computeBaseFontSizeFromWidth(
                this.grapherState.captionedChartBounds
            )
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    private bindToWindow(): void {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = (): void =>
            setWindowQueryStr(queryParamsToStr(this.grapherState.changedParams))
        const debouncedPushParams = _.debounce(pushParams, 100)

        reaction(
            () => this.grapherState.changedParams,
            () => (this.debounceMode ? debouncedPushParams() : pushParams())
        )

        autorun(() => (document.title = this.grapherState.currentTitle))
    }

    @action.bound private setUpWindowResizeEventHandler(): void {
        const updateWindowDimensions = (): void => {
            this.grapherState.windowInnerWidth = window.innerWidth
            this.grapherState.windowInnerHeight = window.innerHeight
        }
        const onResize = _.debounce(updateWindowDimensions, 400, {
            leading: true,
        })

        if (typeof window !== "undefined") {
            updateWindowDimensions()
            window.addEventListener("resize", onResize)
            this.grapherState.disposers.push(() => {
                window.removeEventListener("resize", onResize)
            })
        }
    }

    override componentDidMount(): void {
        this.setBaseFontSize()
        this.setUpIntersectionObserver()
        this.setUpWindowResizeEventHandler()
        exposeInstanceOnWindow(this, "grapher")
        // Emit a custom event when the grapher is ready
        // We can use this in global scripts that depend on the grapher e.g. the site-screenshots tool
        this.grapherState.disposers.push(
            reaction(
                () => this.grapherState.isReady,
                () => {
                    if (this.grapherState.isReady) {
                        document.dispatchEvent(
                            new CustomEvent(GRAPHER_LOADED_EVENT_NAME, {
                                detail: { grapher: this },
                            })
                        )
                    }
                }
            ),
            reaction(
                () => this.grapherState.facetStrategy,
                () => this.grapherState.focusArray.clear()
            )
        )
        if (this.grapherState.bindUrlToWindow) this.bindToWindow()
        if (this.grapherState.enableKeyboardShortcuts)
            this.bindKeyboardShortcuts()
    }

    private _shortcutsBound = false
    private bindKeyboardShortcuts(): void {
        if (this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.bind(shortcut.combo, () => {
                shortcut.fn()
                this.grapherState.analytics.logKeyboardShortcut(
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

    override componentWillUnmount(): void {
        this.unbindKeyboardShortcuts()
        this.dispose()
    }

    override componentDidUpdate(): void {
        this.setBaseFontSize()
    }

    override componentDidCatch(error: Error): void {
        this.setError(error)
        this.grapherState.analytics.logGrapherViewError(error)
    }

    debounceMode = false
}
const defaultObject = objectWithPersistablesToObject(
    new GrapherState({}),
    grapherKeysToSerialize
)
