import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import {
    observable,
    computed,
    action,
    autorun,
    runInAction,
    reaction,
    IReactionDisposer,
    observe,
} from "mobx"
import { bind } from "decko"
import {
    uniqWith,
    isEqual,
    uniq,
    fetchJSON,
    getErrorMessageRelatedQuestionUrl,
    slugify,
    identity,
    lowerCaseFirstLetterUnlessAbbreviation,
    isMobile,
    isVisible,
    VNode,
    throttle,
    isTouchDevice,
    next,
    sampleFrom,
    range,
    difference,
    exposeInstanceOnWindow,
    findClosestTime,
} from "grapher/utils/Util"
import {
    ChartTypeName,
    GrapherTabOption,
    ScaleType,
    StackMode,
    DimensionProperty,
    EntitySelectionMode,
    HighlightToggleConfig,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    BASE_FONT_SIZE,
    CookieKey,
    FacetStrategy,
    ThereWasAProblemLoadingThisChart,
} from "grapher/core/GrapherConstants"
import {
    LegacyChartDimensionInterface,
    LegacyVariablesAndEntityKey,
} from "coreTable/LegacyVariableCode"
import * as Cookies from "js-cookie"
import {
    ChartDimension,
    LegacyDimensionsManager,
} from "grapher/chart/ChartDimension"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { TooltipProps, TooltipManager } from "grapher/tooltip/TooltipProps"
import { BAKED_GRAPHER_URL, ENV, ADMIN_BASE_URL } from "settings"
import {
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    TimeBounds,
    getTimeDomainFromQueryString,
    TimeBound,
    minTimeToJSON,
    maxTimeToJSON,
    timeBoundToTimeBoundString,
} from "grapher/utils/TimeBounds"
import {
    GlobalEntitySelection,
    subscribeGrapherToGlobalEntitySelection,
} from "site/globalEntityControl/GlobalEntitySelection"
import {
    strToQueryParams,
    queryParamsToStr,
    QueryParams,
} from "utils/client/url"
import { populationMap } from "coreTable/PopulationMap"
import {
    GrapherInterface,
    grapherKeysToSerialize,
    GrapherQueryParams,
    LegacyGrapherInterface,
    legacyQueryParamsToCurrentQueryParams,
} from "grapher/core/GrapherInterface"
import { DimensionSlot } from "grapher/chart/DimensionSlot"
import { Analytics } from "./Analytics"
import { EntityUrlBuilder } from "./EntityUrlBuilder"
import { MapProjectionName } from "grapher/mapCharts/MapProjections"
import { LogoOption } from "grapher/captionedChart/Logos"
import { AxisConfig, FontSizeManager } from "grapher/axis/AxisConfig"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import { MapConfig } from "grapher/mapCharts/MapConfig"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import {
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    updatePersistables,
} from "grapher/persistable/Persistable"
import { ColumnSlug, Time } from "coreTable/CoreTableConstants"
import { isOnTheMap } from "grapher/mapCharts/EntitiesOnTheMap"
import { ChartManager } from "grapher/chart/ChartManager"
import { UrlBinder, ObservableUrl } from "grapher/utils/UrlBinder"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import {
    AbsRelToggleManager,
    FooterControls,
    FooterControlsManager,
    HighlightToggleManager,
    SmallCountriesFilterManager,
} from "grapher/controls/Controls"
import { TooltipView } from "grapher/tooltip/Tooltip"
import { EntitySelectorModal } from "grapher/controls/EntitySelectorModal"
import {
    DownloadTab,
    DownloadTabManager,
} from "grapher/downloadTab/DownloadTab"
import * as ReactDOM from "react-dom"
import { observer } from "mobx-react"
import "d3-transition"
import { SourcesTab, SourcesTabManager } from "grapher/sourcesTab/SourcesTab"
import { DataTable, DataTableManager } from "grapher/dataTable/DataTable"
import { MapChartManager } from "grapher/mapCharts/MapChartConstants"
import { DiscreteBarChartManager } from "grapher/barCharts/DiscreteBarChartConstants"
import { Command, CommandPalette } from "grapher/controls/CommandPalette"
import { ShareMenuManager } from "grapher/controls/ShareMenu"
import {
    CaptionedChart,
    CaptionedChartManager,
    StaticCaptionedChart,
} from "grapher/captionedChart/CaptionedChart"
import {
    TimelineController,
    TimelineManager,
} from "grapher/timeline/TimelineController"
import {
    EntityId,
    EntityName,
    OwidColumnDef,
} from "coreTable/OwidTableConstants"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import * as Mousetrap from "mousetrap"
import { SlideShowController } from "grapher/slideshowController/SlideShowController"
import { ChartComponentClassMap } from "grapher/chart/ChartTypeMap"
import { ColorSchemeName } from "grapher/color/ColorConstants"

declare const window: any

const legacyConfigToConfig = (
    config: LegacyGrapherInterface | GrapherInterface
): GrapherInterface => {
    const legacyConfig = config as LegacyGrapherInterface
    if (!legacyConfig.selectedData) return legacyConfig

    const newConfig = { ...legacyConfig } as GrapherInterface
    newConfig.selectedEntityIds = legacyConfig.selectedData.map(
        (row) => row.entityId
    )
    return newConfig
}

const DEFAULT_MS_PER_TICK = 100

// Exactly the same as GrapherInterface, but contains options that developers want but authors won't be touching.
export interface GrapherProgrammaticInterface extends GrapherInterface {
    externalDataUrl?: string // This is temporarily used for testing legacy prod charts locally. Will be removed
    owidDataset?: LegacyVariablesAndEntityKey // This is temporarily used for testing. Will be removed
    manuallyProvideData?: boolean // This will be removed.
    hideEntityControls?: boolean
    dropUnchangedUrlParams?: boolean
    queryStr?: string
    isEmbed?: boolean
    enableKeyboardShortcuts?: boolean
    isMediaCard?: boolean
    globalEntitySelection?: GlobalEntitySelection
    isExport?: boolean
    bounds?: Bounds
    table?: OwidTable
    bakedGrapherURL?: string
    getGrapherInstance?: (instance: Grapher) => void
}

@observer
export class Grapher
    extends React.Component<GrapherProgrammaticInterface>
    implements
        TimelineManager,
        ChartManager,
        FontSizeManager,
        CaptionedChartManager,
        SourcesTabManager,
        DownloadTabManager,
        DiscreteBarChartManager,
        LegacyDimensionsManager,
        ObservableUrl,
        ShareMenuManager,
        SmallCountriesFilterManager,
        HighlightToggleManager,
        AbsRelToggleManager,
        TooltipManager,
        FooterControlsManager,
        DataTableManager,
        MapChartManager {
    @observable.ref type = ChartTypeName.LineChart
    @observable.ref id?: number = undefined
    @observable.ref version = 1
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle = ""
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note = ""
    @observable.ref hideTitleAnnotation?: boolean = undefined
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined
    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined
    @observable.ref addCountryMode = EntitySelectionMode.MultipleEntities
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode = StackMode.absolute
    @observable.ref hideLegend?: boolean = false
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle? = true
    @observable.ref entityType = "country"
    @observable.ref entityTypePlural = "countries"
    @observable.ref hideTimeline?: boolean = undefined
    @observable.ref zoomToSelection?: boolean = undefined
    @observable.ref minPopulationFilter?: number = undefined
    @observable.ref showYearLabels?: boolean = undefined // Always show year in labels for bar charts
    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab = GrapherTabOption.chart
    @observable.ref overlay?: GrapherTabOption = undefined
    @observable.ref internalNotes = ""
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl = ""
    @observable.ref isPublished?: boolean = undefined
    @observable.ref baseColorScheme?: ColorSchemeName = undefined
    @observable.ref invertColorScheme?: boolean = undefined
    @observable.ref hideLinesOutsideTolerance?: boolean = undefined
    @observable hideConnectedScatterLines?: boolean = undefined // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: boolean = undefined
    @observable.ref matchingEntitiesOnly?: boolean = undefined

    @observable.ref xAxis = new AxisConfig(undefined, this)
    @observable.ref yAxis = new AxisConfig(undefined, this)
    @observable colorScale = new ColorScaleConfig()
    @observable map = new MapConfig()
    @observable.ref dimensions: ChartDimension[] = []

    @observable selectedEntityNames: EntityName[] = []
    @observable selectedEntityIds: EntityId[] = []
    @observable excludedEntities?: number[] = undefined
    @observable comparisonLines: ComparisonLineConfig[] = [] // todo: Persistables?
    @observable relatedQuestions: RelatedQuestionsConfig[] = [] // todo: Persistables?

    externalDataUrl?: string = undefined // This is temporarily used for testing legacy prod charts locally. Will be removed
    owidDataset?: LegacyVariablesAndEntityKey = undefined // This is temporarily used for testing. Will be removed
    manuallyProvideData?: boolean = false // This will be removed.

    // TODO: Pass these 5 in as options, don't get them as globals.
    isDev = ENV === "development"
    adminBaseUrl = ADMIN_BASE_URL
    analytics = new Analytics(ENV)
    isEditor =
        typeof window !== "undefined" && (window as any).isEditor === true
    @observable bakedGrapherURL = BAKED_GRAPHER_URL

    @observable.ref inputTable: OwidTable

    private legacyConfigAsAuthored: Partial<LegacyGrapherInterface>

    constructor(
        propsWithGrapherInstanceGetter: GrapherProgrammaticInterface = {}
    ) {
        super(propsWithGrapherInstanceGetter)

        const { getGrapherInstance, ...props } = propsWithGrapherInstanceGetter

        this.inputTable = props.table ?? BlankOwidTable()
        const modernConfig = props ? legacyConfigToConfig(props) : props

        this.legacyConfigAsAuthored = props || {}

        this.updateFromObject(modernConfig)

        if (!props.table) this.downloadData()

        this.populateFromQueryParams(
            legacyQueryParamsToCurrentQueryParams(
                strToQueryParams(props.queryStr ?? "")
            )
        )

        if (props.globalEntitySelection) {
            this.disposers.push(
                subscribeGrapherToGlobalEntitySelection(
                    this,
                    props.globalEntitySelection
                )
            )
        }

        if (this.isEditor) this.ensureValidConfigWhenEditing()

        if (getGrapherInstance) getGrapherInstance(this)
    }

    toObject() {
        const obj: GrapherInterface = objectWithPersistablesToObject(
            this,
            grapherKeysToSerialize
        )

        if (this.tableForSelection.hasSelection)
            obj.selectedEntityNames = this.tableForSelection.selectedEntityNames

        deleteRuntimeAndUnchangedProps(obj, defaultObject)

        // todo: nulls got into the DB for this one. we can remove after moving Graphers from DB.
        if (obj.stackMode === null) delete obj.stackMode

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        // todo: remove dimensions concept
        if (this.legacyConfigAsAuthored?.dimensions)
            obj.dimensions = this.legacyConfigAsAuthored.dimensions

        return obj
    }

    @action.bound downloadData() {
        if (this.owidDataset) this._receiveLegacyData(this.owidDataset)
        else if (this.externalDataUrl)
            this.downloadLegacyDataFromUrl(this.externalDataUrl)
        else if (!this.manuallyProvideData)
            this.downloadLegacyDataFromOwidVariableIds()
    }

    @action.bound updateFromObject(obj?: GrapherProgrammaticInterface) {
        if (!obj) return

        // we can remove when we purge current graphers which have this set.
        if (obj.stackMode === null) delete obj.stackMode

        updatePersistables(this, obj)

        // Regression fix: some legacies have this set to Null. Todo: clean DB.
        if (obj.originUrl === null) this.originUrl = ""

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime)
            this.minTime = minTimeBoundFromJSONOrNegativeInfinity(obj.minTime)
        if (obj.maxTime)
            this.maxTime = maxTimeBoundFromJSONOrPositiveInfinity(obj.maxTime)

        // Todo: remove once we are more RAII.
        if (obj?.dimensions?.length)
            this.setDimensionsFromConfigs(obj.dimensions)
    }

    @action.bound populateFromQueryParams(params: GrapherQueryParams) {
        // Set tab if specified
        const tab = params.tab
        if (tab) {
            if (!this.availableTabs.includes(tab as GrapherTabOption))
                console.error("Unexpected tab: " + tab)
            else this.tab = tab as GrapherTabOption
        }

        const overlay = params.overlay
        if (overlay) {
            if (!this.availableTabs.includes(overlay as GrapherTabOption))
                console.error("Unexpected overlay: " + overlay)
            else this.overlay = overlay as GrapherTabOption
        }

        // Stack mode for bar and stacked area charts
        this.stackMode = (params.stackMode ?? this.stackMode) as StackMode

        this.zoomToSelection =
            params.zoomToSelection === "true" ? true : this.zoomToSelection

        this.minPopulationFilter = params.minPopulationFilter
            ? parseInt(params.minPopulationFilter)
            : this.minPopulationFilter

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

        if (params.country) {
            // Selected countries -- we can't actually look these up until we have the data
            this.selectedEntitiesInQueryParam = EntityUrlBuilder.queryParamToEntities(
                params.country
            )
        }
    }

    @observable private selectedEntitiesInQueryParam: string[] = []

    @action.bound private setTimeFromTimeQueryParam(time: string) {
        this.timelineHandleTimeBounds = getTimeDomainFromQueryString(time)
    }

    @computed private get isChartOrMapTab() {
        return this.tab === GrapherTabOption.chart || this.isOnMapTab
    }

    @computed private get isOnMapTab() {
        return this.tab === GrapherTabOption.map
    }

    @computed private get tableForSelection() {
        return this.inputTable // perform selection at root level
    }

    // If an author sets a timeline filter run it early in the pipeline so to the charts it's as if the filtered times do not exist
    @computed private get tableAfterAuthorTimelineFilter() {
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

    @computed private get tableAfterPopulationFilter() {
        const table = this.tableAfterAuthorTimelineFilter
        // todo: could make these separate memoized computeds to speed up
        // todo: add cross filtering. 1 dimension at a time.
        return this.minPopulationFilter
            ? table.filterByPopulation(this.minPopulationFilter)
            : table
    }

    @computed
    private get tableAfterPopulationFilterAndActiveChartTransform(): OwidTable {
        const table = this.tableAfterPopulationFilter
        if (!this.isChartOrMapTab) return table
        return this.chartInstance.transformTable(table)
    }

    @computed get chartInstance() {
        // Note: when timeline handles on a LineChart are collapsed into a single handle, the
        // LineChart turns into a DiscreteBar.
        const chartTypeName = this.isOnMapTab
            ? ChartTypeName.WorldMap
            : this.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart

        const ChartClass = ChartComponentClassMap.get(chartTypeName)!
        return new ChartClass({ manager: this })
    }

    @computed get table() {
        return this.tableAfterAuthorTimelineFilter
    }

    @computed
    private get tableAfterPopulationAndActiveChartAndTimelineFilters() {
        const { startTime, endTime } = this
        const table = this.tableAfterPopulationFilterAndActiveChartTransform

        if (startTime === undefined || endTime === undefined) return table

        if (
            this.isOnMapTab ||
            this.isDiscreteBar ||
            this.isLineChartThatTurnedIntoDiscreteBar
        ) {
            return table.filterByTargetTimes([endTime])
        }
        if (this.isSlopeChart) {
            return table.filterByTargetTimes([startTime, endTime])
        }
        return table.filterByTimeRange(startTime, endTime)
    }

    @computed get transformedTable() {
        return this.tableAfterPopulationAndActiveChartAndTimelineFilters
    }

    @observable.ref isMediaCard = false
    @observable.ref isExporting = !!this.props.isExport
    @observable.ref tooltip?: TooltipProps
    @observable isPlaying = false
    @observable.ref isSelectingData = false

    @computed get isStaticSvg() {
        return this.isExporting
    }

    @computed get editUrl() {
        return Cookies.get(CookieKey.isAdmin) || this.isDev
            ? `${this.adminBaseUrl}/admin/charts/${this.id}/edit`
            : undefined
    }

    private populationFilterToggleOption = 1e6
    // Make the default filter toggle option reflect what is initially loaded.
    @computed get populationFilterOption() {
        if (this.minPopulationFilter)
            this.populationFilterToggleOption = this.minPopulationFilter
        return this.populationFilterToggleOption
    }

    // Checks if the data 1) is about countries and 2) has countries with less than the filter option. Used to partly determine whether to show the filter control.
    @computed private get hasCountriesSmallerThanFilterOption() {
        return this.inputTable.availableEntityNames.some(
            (entityName) =>
                populationMap[entityName] &&
                populationMap[entityName] < this.populationFilterOption
        )
    }

    // at startDrag, we want to show the full axis
    @observable.ref useTimelineDomains = false

    @action.bound private async downloadLegacyDataFromUrl(url: string) {
        const json = await fetchJSON(url)
        this._receiveLegacyData(json)
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
        return !!Cookies.get(CookieKey.isAdmin)
    }

    @action.bound private async downloadLegacyDataFromOwidVariableIds() {
        if (this.variableIds.length === 0)
            // No data to download
            return

        try {
            if (this.useAdminAPI) {
                const json = await window.admin.getJSON(
                    `/api/data/variables/${this.dataFileName}`
                )
                this._receiveLegacyData(json)
            } else {
                await this.downloadLegacyDataFromUrl(this.dataUrl)
            }
        } catch (err) {
            console.error(err)
        }
    }

    @action.bound receiveLegacyData(json: LegacyVariablesAndEntityKey) {
        this._receiveLegacyData(json)
    }

    @action.bound private _receiveLegacyData(
        json: LegacyVariablesAndEntityKey
    ) {
        this.inputTable = OwidTable.fromLegacy(
            json,
            this.legacyConfigAsAuthored
        )

        if (this.selectedEntitiesInQueryParam.length) {
            const {
                notFoundEntities,
                foundEntities,
            } = EntityUrlBuilder.scanUrlForEntityNames(
                this.selectedEntitiesInQueryParam,
                this.inputTable.entityCodeToNameMap,
                this.inputTable.availableEntityNameSet
            )

            this.inputTable.setSelectedEntities(foundEntities)
            if (notFoundEntities.length)
                this.analytics.logEntitiesNotFoundError(notFoundEntities)
        } else this.applyOriginalSelection()
    }

    @action.bound private applyOriginalSelection() {
        if (this.selectedEntityNames.length)
            this.inputTable.setSelectedEntities(this.selectedEntityNames)
        else if (this.selectedEntityIds.length)
            this.inputTable.setSelectedEntitiesByEntityId(
                this.selectedEntityIds
            )
    }

    @observable private _baseFontSize = BASE_FONT_SIZE

    @computed get baseFontSize() {
        if (this.isMediaCard) return 24
        else if (this.isExporting) return 18
        return this._baseFontSize
    }

    set baseFontSize(val: number) {
        this._baseFontSize = val
    }

    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady() {
        return this.dimensions.length > 0 && this.loadingDimensions.length === 0
    }

    async whenReady() {
        return new Promise((resolve) => {
            if (this.isReady) return resolve()
            observe(this, "isReady", () => {
                if (this.isReady) resolve()
            })
        })
    }

    @computed private get loadingDimensions() {
        return this.dimensions.filter(
            (dim) => !this.inputTable.has(dim.columnSlug)
        )
    }

    @computed get isIframe() {
        return window.self !== window.top
    }

    @computed get times(): Time[] {
        const columnSlugs = this.isOnMapTab
            ? [this.mapColumnSlug]
            : this.yColumnSlugs

        // Generate the times only after the chart transform has been applied, so that we don't show
        // times on the timeline for which data may not exist, e.g. when the selected entity
        // doesn't contain data for all years in the table.
        // -@danielgavrilov, 2020-10-22
        return this.tableAfterPopulationFilterAndActiveChartTransform.getTimesUniqSortedAscForColumns(
            columnSlugs
        )
    }

    @computed get startHandleTimeBound(): TimeBound {
        if (
            this.isDiscreteBarOrLineChartTransformedIntoDiscreteBar ||
            this.isOnMapTab
        )
            return this.endHandleTimeBound
        return this.timelineHandleTimeBounds[0]
    }

    set startHandleTimeBound(newValue: TimeBound) {
        if (this.isOnMapTab)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                newValue,
                this.timelineHandleTimeBounds[1],
            ]
    }

    set endHandleTimeBound(newValue: TimeBound) {
        if (
            this.isOnMapTab ||
            this.isOnTableTab ||
            this.isDiscreteBarOrLineChartTransformedIntoDiscreteBar
        )
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

    @computed get startTime(): Time | undefined {
        return findClosestTime(this.times, this.startHandleTimeBound)
    }

    @computed get endTime(): Time | undefined {
        return findClosestTime(this.times, this.endHandleTimeBound)
    }

    @computed private get isDiscreteBarOrLineChartTransformedIntoDiscreteBar() {
        return (
            this.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart ===
                ChartTypeName.DiscreteBar ||
            (this.type === ChartTypeName.LineChart && this.isPlaying)
        )
    }

    @computed get isNativeEmbed() {
        return this.isEmbed && !this.isIframe && !this.isExporting
    }

    @computed.struct private get variableIds() {
        return uniq(this.dimensions.map((d) => d.variableId))
    }

    @computed private get dataFileName() {
        return `${this.variableIds.join("+")}.json?v=${
            this.isEditor ? undefined : this.cacheTag
        }`
    }

    @computed get dataUrl() {
        return `${this.bakedGrapherURL}/data/variables/${this.dataFileName}`
    }

    externalCsvLink = ""

    @computed get hasOWIDLogo() {
        return (
            !this.hideLogo && (this.logo === undefined || this.logo === "owid")
        )
    }

    // todo: did this name get botched in a merge?
    @computed get hasFatalErrors() {
        return this.relatedQuestions.some(
            (question) => !!getErrorMessageRelatedQuestionUrl(question)
        )
    }

    disposers: IReactionDisposer[] = []

    @bind dispose() {
        this.disposers.forEach((dispose) => dispose())
    }

    @computed get fontSize() {
        return this.baseFontSize
    }

    // todo: can we remove this?
    // I believe these states can only occur during editing.
    @action.bound private ensureValidConfigWhenEditing() {
        this.disposers.push(
            reaction(
                () => this.variableIds,
                this.downloadLegacyDataFromOwidVariableIds
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

    @computed private get validDimensions() {
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
                        a: LegacyChartDimensionInterface,
                        b: LegacyChartDimensionInterface
                    ) =>
                        a.property === slot.property &&
                        a.property === b.property
                )
        })

        return validDimensions
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol() {
        let url = this.originUrl
        if (!url.startsWith("http")) url = `https://${url}`
        return url
    }

    @computed get overlayTab() {
        return this.overlay
    }

    @observable.ref dataTableColumnSlugsToShow: ColumnSlug[] = []

    @computed get currentTab() {
        return this.overlay ? this.overlay : this.tab
    }

    set currentTab(desiredTab) {
        if (
            desiredTab === GrapherTabOption.chart ||
            desiredTab === GrapherTabOption.map ||
            desiredTab === GrapherTabOption.table
        ) {
            this.tab = desiredTab
            this.overlay = undefined
            return
        }

        // table tab cannot be downloaded, so revert to default tab
        if (desiredTab === GrapherTabOption.download && this.isOnTableTab)
            this.tab = this.legacyConfigAsAuthored.tab || GrapherTabOption.chart
        this.overlay = desiredTab
    }

    @computed get timelineHandleTimeBounds(): TimeBounds {
        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeBoundFromJSONOrNegativeInfinity(this.minTime),
            maxTimeBoundFromJSONOrPositiveInfinity(this.maxTime),
        ]
    }

    set timelineHandleTimeBounds(value: TimeBounds) {
        this.minTime = value[0]
        this.maxTime = value[1]
    }

    // Get the dimension slots appropriate for this type of chart
    @computed get dimensionSlots() {
        const xAxis = new DimensionSlot(this, DimensionProperty.x)
        const yAxis = new DimensionSlot(this, DimensionProperty.y)
        const color = new DimensionSlot(this, DimensionProperty.color)
        const size = new DimensionSlot(this, DimensionProperty.size)

        if (this.isScatter) return [yAxis, xAxis, size, color]
        else if (this.isTimeScatter) return [yAxis, xAxis]
        else if (this.isSlopeChart) return [yAxis, size, color]
        return [yAxis]
    }

    @computed.struct get filledDimensions() {
        return this.isReady ? this.dimensions : []
    }

    @action.bound addDimension(config: LegacyChartDimensionInterface) {
        this.dimensions.push(new ChartDimension(config, this))
    }

    @action.bound setDimensionsForProperty(
        property: DimensionProperty,
        newConfigs: LegacyChartDimensionInterface[]
    ) {
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
        configs: LegacyChartDimensionInterface[]
    ) {
        this.dimensions = configs.map(
            (config) => new ChartDimension(config, this)
        )
    }

    @computed get displaySlug() {
        return this.slug ?? slugify(this.displayTitle)
    }

    @computed get availableTabs() {
        return [
            this.hasChartTab && GrapherTabOption.chart,
            this.hasMapTab && GrapherTabOption.map,
            GrapherTabOption.table,
            GrapherTabOption.sources,
            GrapherTabOption.download,
        ].filter(identity) as GrapherTabOption[]
    }

    @computed get currentTitle() {
        let text = this.displayTitle
        const selectedEntityNames = this.tableForSelection.selectedEntityNames
        const showTitleAnnotation = !this.hideTitleAnnotation

        if (
            this.tab === GrapherTabOption.chart &&
            this.addCountryMode !== EntitySelectionMode.MultipleEntities &&
            selectedEntityNames.length === 1 &&
            (showTitleAnnotation || this.canChangeEntity)
        ) {
            const entityStr = selectedEntityNames[0]
            if (entityStr.length) text = `${text}, ${entityStr}`
        }

        if (showTitleAnnotation && this.isLineChart && this.isRelativeMode)
            text = "Change in " + lowerCaseFirstLetterUnlessAbbreviation(text)

        if (
            this.isReady &&
            (showTitleAnnotation ||
                (this.hasTimeline &&
                    (this.isLineChartThatTurnedIntoDiscreteBar ||
                        this.isOnMapTab)))
        )
            text += this.timeTitleSuffix

        return text.trim()
    }

    @computed private get isOnOverlay() {
        return (
            this.currentTab === GrapherTabOption.sources ||
            this.currentTab === GrapherTabOption.download
        )
    }

    @computed get hasTimeline() {
        if (this.isStackedBar || this.isStackedArea || this.isDiscreteBar)
            return false
        if (this.isOnOverlay) return false
        if (this.hideTimeline) return false
        if (this.isOnMapTab && this.map.hideTimeline) return false
        return this.times.length > 1
    }

    @computed private get areHandlesOnSameTime() {
        const [start, end] = this.timelineHandleTimeBounds
        return start === end
    }

    @computed get mapColumnSlug() {
        return (this.map.columnSlug || this.yColumnSlug)!
    }

    getColumnForProperty(property: DimensionProperty) {
        return this.dimensions.find((dim) => dim.property === property)?.column
    }

    getSlugForProperty(property: DimensionProperty) {
        return this.dimensions.find((dim) => dim.property === property)
            ?.columnSlug
    }

    @computed get yColumns() {
        return this.filledDimensions
            .filter((dim) => dim.property === DimensionProperty.y)
            .map((dim) => dim.column)
    }

    @computed get yColumnSlugs() {
        return this.dimensions
            .filter((dim) => dim.property === DimensionProperty.y)
            .map((dim) => dim.columnSlug)
    }

    @computed get yColumnSlug() {
        return this.getSlugForProperty(DimensionProperty.y)
    }

    @computed get xColumnSlug() {
        return this.getSlugForProperty(DimensionProperty.x)
    }

    @computed get sizeColumnSlug() {
        return this.getSlugForProperty(DimensionProperty.size)
    }

    @computed get colorColumnSlug() {
        return this.getSlugForProperty(DimensionProperty.color)
    }

    @computed get yScaleType() {
        return this.yAxis.scaleType
    }

    @computed get xScaleType() {
        return this.xAxis.scaleType
    }

    @computed private get timeTitleSuffix() {
        if (!this.table.timeColumn) return "" // Do not show year until data is loaded
        const { startTime, endTime } = this
        const timeColumn = this.table.timeColumn
        const time =
            startTime === endTime
                ? timeColumn.formatValue(startTime)
                : timeColumn.formatValue(startTime) +
                  " to " +
                  timeColumn.formatValue(endTime)

        return ", " + time
    }

    @computed get sourcesLine() {
        return this.sourceDesc !== undefined
            ? this.sourceDesc
            : this.defaultSourcesLine
    }

    @computed get columnsWithSources() {
        return this.inputTable.columnsAsArray.filter((column) => {
            if (
                column.name === "Countries Continents" ||
                column.name === "Total population (Gapminder)"
            )
                return false
            return !!(column.def as OwidColumnDef).source
        })
    }

    @computed private get defaultSourcesLine() {
        let sourceNames = this.columnsWithSources.map(
            (column) => (column.def as OwidColumnDef)?.source?.name || ""
        )

        // Shorten automatic source names for certain major sources
        sourceNames = sourceNames.map((sourceName) => {
            for (const majorSource of [
                "World Bank – WDI",
                "World Bank",
                "ILOSTAT",
            ]) {
                if (sourceName.startsWith(majorSource)) return majorSource
            }
            return sourceName
        })

        return uniq(sourceNames).join(", ")
    }

    @computed private get axisDimensions() {
        return this.filledDimensions.filter(
            (dim) =>
                dim.property === DimensionProperty.y ||
                dim.property === DimensionProperty.x
        )
    }

    @computed private get defaultTitle() {
        const { yColumns } = this
        if (this.isScatter)
            return this.axisDimensions
                .map((d) => d.column.displayName)
                .join(" vs. ")

        if (
            this.hasMultipleYColumns &&
            uniq(yColumns.map((col) => (col.def as OwidColumnDef).datasetName))
                .length === 1
        )
            return (yColumns[0].def as OwidColumnDef).datasetName!

        if (yColumns.length === 2)
            return yColumns.map((col) => col.displayName).join(" and ")

        return yColumns.map((col) => col.displayName).join(", ")
    }

    @computed get displayTitle() {
        return this.title ?? this.defaultTitle
    }

    // Returns an object ready to be serialized to JSON
    @computed get object() {
        return this.toObject()
    }

    @computed get typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart() {
        // Switch to bar chart if a single year is selected. Todo: do we want to do this?
        return this.isLineChartThatTurnedIntoDiscreteBar
            ? ChartTypeName.DiscreteBar
            : this.type
    }

    @computed get isLineChart() {
        return this.type === ChartTypeName.LineChart
    }
    @computed get isScatter() {
        return this.type === ChartTypeName.ScatterPlot
    }
    @computed get isTimeScatter() {
        return this.type === ChartTypeName.TimeScatter
    }
    @computed get isStackedArea() {
        return this.type === ChartTypeName.StackedArea
    }
    @computed get isSlopeChart() {
        return this.type === ChartTypeName.SlopeChart
    }
    @computed get isDiscreteBar() {
        return this.type === ChartTypeName.DiscreteBar
    }
    @computed get isStackedBar() {
        return this.type === ChartTypeName.StackedBar
    }

    @computed get isLineChartThatTurnedIntoDiscreteBar() {
        return this.isLineChart && this.areHandlesOnSameTime
    }

    @computed get activeColorScale() {
        const chart = this.chartInstance as any
        return chart.colorScale
    }

    @computed get supportsMultipleYColumns() {
        return !(this.isScatter || this.isTimeScatter || this.isSlopeChart)
    }

    @computed private get xDimension() {
        return this.filledDimensions.find(
            (d) => d.property === DimensionProperty.x
        )
    }

    // todo: remove. do this at table filter level
    getEntityNamesToShow(filterBackgroundEntities?: boolean): EntityName[] {
        return []
        // let entityNames = filterBackgroundEntities
        //     ? this.table.selectedEntityNames
        //     : this.possibleEntityNames

        // if (this.matchingEntitiesOnly && this.colorDimension)
        //     entityNames = intersection(
        //         entityNames,
        //         this.colorDimension.column.entityNamesUniqArr
        //     )

        // if (this.excludedEntityNames)
        //     entityNames = entityNames.filter(
        //         (entity) => !this.excludedEntityNames.includes(entity)
        //     )

        // return entityNames
    }

    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime() {
        return this.xDimension && this.xDimension.targetTime
    }

    set xOverrideTime(value: number | undefined) {
        this.xDimension!.targetTime = value
    }

    // todo: move to table
    @computed get excludedEntityNames(): EntityName[] {
        const entityIds = this.excludedEntities || []
        const entityNameMap = this.table.entityIdToNameMap
        return entityIds
            .map((entityId) => entityNameMap.get(entityId)!)
            .filter((d) => d)
    }

    @computed get idealBounds() {
        return this.isMediaCard
            ? new Bounds(0, 0, 1200, 630)
            : new Bounds(0, 0, 850, 600)
    }

    @computed get hasYDimension() {
        return this.dimensions.some((d) => d.property === DimensionProperty.y)
    }

    get staticSVG() {
        return ReactDOMServer.renderToStaticMarkup(
            <StaticCaptionedChart manager={this} bounds={this.idealBounds} />
        )
    }

    @computed get mapConfig() {
        return this.map
    }

    @computed get cacheTag() {
        return this.version.toString()
    }

    @computed get mapIsClickable() {
        return (
            this.hasChartTab &&
            (this.isLineChart || this.isScatter) &&
            !isMobile()
        )
    }

    @computed get relativeToggleLabel() {
        if (this.isScatter || this.isTimeScatter) return "Average annual change"
        else if (this.isLineChart) return "Relative change"
        return "Relative"
    }

    // NB: The timeline scatterplot in relative mode calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode() {
        return this.stackMode === StackMode.relative
    }

    @computed get canToggleRelativeMode() {
        if (this.isLineChart)
            return !this.hideRelativeToggle && !this.areHandlesOnSameTime
        return !this.hideRelativeToggle
    }

    // Filter data to what can be display on the map (across all times)
    @computed get mappableData() {
        const mapColumn = this.inputTable.get(this.mapColumnSlug)
        return (
            mapColumn?.owidRows.filter((row) => isOnTheMap(row.entityName)) ??
            []
        )
    }

    @computed private get hasMultipleCountriesOnTheMap() {
        return this.mappableData.length > 1
    }

    static bootstrap({
        jsonConfig,
        containerNode,
        isEmbed,
        queryStr,
        globalEntitySelection,
    }: {
        jsonConfig: GrapherInterface
        containerNode: HTMLElement
        isEmbed?: boolean
        queryStr?: string
        globalEntitySelection?: GlobalEntitySelection
    }) {
        let view
        function render() {
            const enableKeyboardShortcuts = !isEmbed
            const props: GrapherProgrammaticInterface = {
                ...jsonConfig,
                isEmbed,
                enableKeyboardShortcuts,
                queryStr,
                globalEntitySelection,
                bounds: Bounds.fromRect(containerNode.getBoundingClientRect()),
            }
            view = ReactDOM.render(<Grapher {...props} />, containerNode)
        }

        render()
        window.addEventListener("resize", throttle(render))
        return view
    }

    @computed get isEmbed() {
        return (
            this.props.isEmbed ||
            (!this.isExporting && (window.self !== window.top || this.isEditor))
        )
    }

    @computed get isMobile() {
        return isMobile()
    }

    @computed private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get isPortrait() {
        return this.bounds.width < this.bounds.height && this.bounds.width < 850
    }

    @computed private get isLandscape() {
        return !this.isPortrait
    }

    @computed private get authorWidth() {
        return this.isPortrait ? 400 : 680
    }
    @computed private get authorHeight() {
        return this.isPortrait ? 640 : 480
    }

    // If the available space is very small, we use all of the space given to us
    @computed private get useIdealBounds() {
        const {
            isEditor,
            isEmbed,
            isExporting,
            bounds,
            authorWidth,
            authorHeight,
        } = this

        if (isEditor) return true
        if (isEmbed) return false
        if (isExporting) return false // If the user is using interactive version and then goes to export chart, use current bounds to maintain WSYIWYG
        if (bounds.height < authorHeight || bounds.width < authorWidth)
            return false

        return true
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed private get scaleToFitIdeal() {
        return Math.min(
            (this.bounds.width * 0.95) / this.authorWidth,
            (this.bounds.height * 0.95) / this.authorHeight
        )
    }

    // These are the final render dimensions
    // Todo: add explanation around why isExporting removes 5 px
    @computed private get renderWidth() {
        return this.useIdealBounds
            ? this.authorWidth * this.scaleToFitIdeal
            : this.bounds.width - (this.isExporting ? 0 : 5)
    }
    @computed private get renderHeight() {
        return this.useIdealBounds
            ? this.authorHeight * this.scaleToFitIdeal
            : this.bounds.height - (this.isExporting ? 0 : 5)
    }

    @computed get tabBounds() {
        const bounds = new Bounds(0, 0, this.renderWidth, this.renderHeight)
        return this.isExporting
            ? bounds
            : bounds.padBottom(this.footerControlsHeight)
    }

    @observable.ref private popups: VNode[] = []

    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get containerElement() {
        return this.base.current || undefined
    }

    @observable private hasBeenVisible = false
    @observable hasError = false

    @computed private get classNames() {
        const classNames = [
            "chart",
            this.isExporting && "export",
            this.isEditor && "editor",
            this.isEmbed && "embed",
            this.isPortrait && "portrait",
            this.isLandscape && "landscape",
            isTouchDevice() && "is-touch",
        ]

        return classNames.filter((n) => !!n).join(" ")
    }

    // todo: clean up this popup stuff
    addPopup(vnode: VNode) {
        this.popups = this.popups.concat([vnode])
    }

    removePopup(vnodeType: any) {
        this.popups = this.popups.filter((d) => !(d.type === vnodeType))
    }

    @computed private get isOnTableTab() {
        return this.tab === GrapherTabOption.table
    }

    private renderPrimaryTab() {
        if (this.isChartOrMapTab) return <CaptionedChart manager={this} />

        const { tabBounds } = this
        if (this.isOnTableTab)
            // todo: should this "Div" and styling just be in DataTable class?
            return (
                <div
                    className="tableTab"
                    style={{ ...tabBounds.toCSS(), position: "absolute" }}
                >
                    <DataTable bounds={tabBounds} manager={this} />
                </div>
            )

        return undefined
    }

    private renderOverlayTab() {
        const bounds = this.tabBounds
        if (this.overlayTab === GrapherTabOption.sources)
            return (
                <SourcesTab key="sourcesTab" bounds={bounds} manager={this} />
            )
        if (this.overlayTab === GrapherTabOption.download)
            return (
                <DownloadTab key="downloadTab" bounds={bounds} manager={this} />
            )
        return undefined
    }

    private get commandPalette() {
        return this.enableKeyboardShortcuts ? (
            <CommandPalette commands={this.keyboardShortcuts} display="none" />
        ) : null
    }

    private renderReady() {
        return (
            <>
                {this.hasBeenVisible && this.renderPrimaryTab()}
                <FooterControls manager={this} />
                {this.renderOverlayTab()}
                {this.popups}
                <TooltipView
                    width={this.renderWidth}
                    height={this.renderHeight}
                    tooltipProvider={this}
                />
                {this.isSelectingData && (
                    <EntitySelectorModal
                        canChangeEntity={this.canChangeEntity}
                        table={this.inputTable}
                        key="entitySelector"
                        isMobile={this.isMobile}
                        onDismiss={action(() => (this.isSelectingData = false))}
                    />
                )}
            </>
        )
    }

    private enableKeyboardShortcuts = false

    formatTimeFn(time: Time) {
        return this.inputTable.timeColumnFormatFunction(time)
    }

    @action.bound private toggleTabCommand() {
        this.currentTab = next(this.availableTabs, this.currentTab)
    }

    @action.bound private togglePlayingCommand() {
        this.timelineController.togglePlay()
    }

    private get keyboardShortcuts(): Command[] {
        const temporaryFacetTestCommands = range(0, 10).map((num) => {
            return { combo: `${num}`, fn: () => this.randomSelection(num) }
        })
        const shortcuts = [
            ...temporaryFacetTestCommands,
            {
                combo: "t",
                fn: () => this.toggleTabCommand(),
                title: "Toggle tab",
                category: "Navigation",
            },
            {
                combo: "?",
                fn: () => CommandPalette.togglePalette(),
                title: `Toggle Help`,
                category: "Navigation",
            },
            {
                combo: "a",
                fn: () =>
                    this.inputTable.hasSelection
                        ? this.inputTable.clearSelection()
                        : this.inputTable.selectAll(),
                title: this.inputTable.hasSelection
                    ? `Select None`
                    : `Select All`,
                category: "Selection",
            },
            {
                combo: "f",
                fn: () => this.toggleFilterAllCommand(),
                title: "Hide unselected",
                category: "Selection",
            },
            {
                combo: "p",
                fn: () => this.togglePlayingCommand(),
                title: this.isPlaying ? `Pause` : `Play`,
                category: "Timeline",
            },
            {
                combo: "f",
                fn: () => this.toggleFacetStrategy(),
                title: `Toggle Faceting`,
                category: "Chart",
            },
            {
                combo: "l",
                fn: () => this.toggleYScaleTypeCommand(),
                title: "Toggle Y log/linear",
                category: "Chart",
            },
            {
                combo: "esc",
                fn: () => (this.hasError = false),
            },
            {
                combo: "z",
                fn: () => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "shift+o",
                fn: () => this.clearQueryParams(),
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

    @observable slideShow?: SlideShowController

    @action.bound private toggleTimelineCommand() {
        // Todo: add tests for this
        this.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.timeParam!)
        )
    }

    @action.bound private toggleFilterAllCommand() {
        this.minPopulationFilter =
            this.minPopulationFilter === 2e9 ? undefined : 2e9
    }

    @action.bound private toggleYScaleTypeCommand() {
        this.yAxis.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.yAxis.scaleType
        )
    }

    @action.bound private toggleFacetStrategy() {
        this.facet = next(this.availableFacetStrategies, this.facet)
    }

    @observable facet?: FacetStrategy

    @computed private get hasMultipleYColumns() {
        return this.yColumnSlugs.length > 1
    }

    @computed get selectedEntityNamesInOrder(): EntityName[] {
        const { selectedData } = this.legacyConfigAsAuthored
        const map = this.inputTable.entityIdToNameMap
        return selectedData
            ? selectedData.map((item) => map.get(item.entityId)!)
            : []
    }

    @computed get selectedColumnNamesInOrder(): string[] {
        const { selectedData } = this.legacyConfigAsAuthored
        const dimensions = this.filledDimensions
        return selectedData
            ? selectedData.map(
                  (item) => dimensions[item.index].column.displayName
              )
            : []
    }

    @computed private get availableFacetStrategies() {
        const strategies: (FacetStrategy | undefined)[] = [undefined]

        if (this.hasMultipleYColumns) {
            strategies.push(FacetStrategy.column)
            if (
                this.tableForSelection.numAvailableEntityNames > 1 &&
                this.hasMultipleCountriesOnTheMap
            )
                strategies.push(FacetStrategy.columnWithMap)
        }

        if (this.tableForSelection.numSelectedEntities > 1) {
            strategies.push(FacetStrategy.country)
            if (this.hasMultipleCountriesOnTheMap)
                strategies.push(FacetStrategy.countryWithMap)
        }

        return strategies
    }

    private disableAutoFaceting = true // turned off for now
    @computed get facetStrategy() {
        if (this.facet && this.availableFacetStrategies.includes(this.facet))
            return this.facet

        if (this.disableAutoFaceting) return undefined

        // Auto facet on SingleEntity charts with multiple selected entities
        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.tableForSelection.numSelectedEntities > 1
        )
            return FacetStrategy.country

        // Auto facet when multiple slugs and multiple entities selected. todo: not sure if this is correct.
        if (
            this.addCountryMode === EntitySelectionMode.MultipleEntities &&
            this.hasMultipleYColumns &&
            this.tableForSelection.numSelectedEntities > 1
        )
            return FacetStrategy.column

        return undefined
    }

    @action.bound randomSelection(num: number) {
        // Continent, Population, GDP PC, GDP, PopDens, UN, Language, etc.
        this.hasError = false
        const currentSelection = this.tableForSelection.selectedEntityNames
            .length
        const newNum = num ? num : currentSelection ? currentSelection * 2 : 10
        this.tableForSelection.setSelectedEntities(
            sampleFrom(
                this.tableForSelection.availableEntityNames,
                newNum,
                Date.now()
            )
        )
    }

    private renderError() {
        return (
            <div
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
            </div>
        )
    }

    render() {
        // TODO how to handle errors in exports?
        // TODO tidy this up
        if (this.isExporting) return this.renderPrimaryTab() // todo: remove this? should have a simple toStaticSVG for importing.

        const { renderWidth, renderHeight } = this

        const style = {
            width: renderWidth,
            height: renderHeight,
            fontSize: this.baseFontSize,
        }

        return (
            <div ref={this.base} className={this.classNames} style={style}>
                {this.commandPalette}
                {this.hasError ? this.renderError() : this.renderReady()}
            </div>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound private checkVisibility() {
        if (!this.hasBeenVisible && isVisible(this.base.current))
            this.hasBeenVisible = true
    }

    @action.bound private setBaseFontSize() {
        const { renderWidth } = this
        if (renderWidth <= 400) this.baseFontSize = 14
        else if (renderWidth < 1080) this.baseFontSize = 16
        else if (renderWidth >= 1080) this.baseFontSize = 18
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    bindToWindow() {
        new UrlBinder().bindToWindow(this)
        autorun(() => (document.title = this.currentTitle))
    }

    componentDidMount() {
        window.addEventListener("scroll", this.checkVisibility)
        this.setBaseFontSize()
        this.checkVisibility()
        exposeInstanceOnWindow(this, "grapher")
    }

    private _shortcutsBound = false
    private bindKeyboardShortcuts() {
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

    private unbindKeyboardShortcuts() {
        if (!this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.unbind(shortcut.combo)
        })
        this._shortcutsBound = false
    }

    componentWillUnmount() {
        this.unbindKeyboardShortcuts()
        window.removeEventListener("scroll", this.checkVisibility)
        this.dispose()
    }

    componentDidUpdate() {
        this.setBaseFontSize()
        this.checkVisibility()
        if (this.enableKeyboardShortcuts) this.bindKeyboardShortcuts()
    }

    componentDidCatch(error: any, info: any) {
        this.hasError = true
        this.analytics.logChartError(error, info)
    }

    @observable isShareMenuActive = false

    @computed get hasRelatedQuestion() {
        if (!this.relatedQuestions.length) return false
        const question = this.relatedQuestions[0]
        return !!question && !!question.text && !!question.url
    }

    @computed private get footerControlsLines() {
        return this.hasTimeline ? 2 : 1
    }

    @computed get footerControlsHeight() {
        const footerRowHeight = 32 // todo: cleanup. needs to keep in sync with grapher.scss' $footerRowHeight
        return (
            this.footerControlsLines * footerRowHeight +
            (this.hasRelatedQuestion ? 20 : 0)
        )
    }

    @action.bound clearQueryParams() {
        const { authorsVersion } = this
        this.tab = authorsVersion.tab
        this.xAxis.scaleType = authorsVersion.xAxis.scaleType
        this.yAxis.scaleType = authorsVersion.yAxis.scaleType
        this.stackMode = authorsVersion.stackMode
        this.zoomToSelection = authorsVersion.zoomToSelection
        this.minPopulationFilter = authorsVersion.minPopulationFilter
        this.compareEndPointsOnly = authorsVersion.compareEndPointsOnly
        this.minTime = authorsVersion.minTime
        this.maxTime = authorsVersion.maxTime
        this.map.time = authorsVersion.map.time
        this.map.projection = authorsVersion.map.projection
        this.tableForSelection.clearSelection()
        this.applyOriginalSelection()
    }

    debounceMode = false

    @computed.struct private get allParams() {
        const params: GrapherQueryParams = {}
        params.tab = this.tab
        params.xScale = this.xAxis.scaleType
        params.yScale = this.yAxis.scaleType
        params.stackMode = this.stackMode
        params.zoomToSelection = this.zoomToSelection ? "true" : undefined
        params.minPopulationFilter = this.minPopulationFilter?.toString()
        params.endpointsOnly = this.compareEndPointsOnly ? "1" : "0"
        params.time = this.timeParam
        params.country = this.countryParam
        params.region = this.map.projection
        return params
    }

    // If the user changes a param so that it matches the author's original param, we drop it.
    // However, in the case of explorers, the user might switch graphers, and so we never want to drop
    // params. This flag turns off dropping of params.
    @observable dropUnchangedUrlParams = true

    @computed get params() {
        return (this.dropUnchangedUrlParams
            ? this.changedParams
            : this.allParams) as QueryParams
    }

    // If you want to compare current state against the published grapher.
    @computed private get authorsVersion() {
        return new Grapher({
            ...this.legacyConfigAsAuthored,
            manuallyProvideData: true,
            queryStr: "",
        })
    }

    // Autocomputed url params to reflect difference between current grapher state
    // and original config state
    @computed.struct private get changedParams() {
        return deleteRuntimeAndUnchangedProps<GrapherQueryParams>(
            this.allParams,
            this.authorsVersion.allParams
        )
    }

    @computed get queryStr() {
        return queryParamsToStr(this.params) + this.baseQueryString
    }

    // If you need to provide external query string params, like from an Explorer
    @observable baseQueryString = ""

    @computed get baseUrl() {
        return this.isPublished
            ? `${this.bakedGrapherURL}/${this.displaySlug}`
            : undefined
    }

    // Get the full url representing the canonical location of this grapher state
    @computed get canonicalUrl() {
        return this.baseUrl ? this.baseUrl + this.queryStr : undefined
    }

    @computed private get hasUserChangedTimeHandles() {
        const authorsVersion = this.authorsVersion
        return (
            this.minTime !== authorsVersion.minTime ||
            this.maxTime !== authorsVersion.maxTime
        )
    }

    @computed private get hasUserChangedMapTimeHandle() {
        return this.map.time !== this.authorsVersion.map.time
    }

    @computed get timeParam() {
        const formatAsDay = this.table.hasDayColumn
        if (
            this.isOnMapTab &&
            this.map.time !== undefined &&
            this.hasUserChangedMapTimeHandle
        )
            return timeBoundToTimeBoundString(this.map.time, formatAsDay)
        if (!this.hasUserChangedTimeHandles) return undefined

        const [startHandleTime, rightHandleTime] = this.timelineHandleTimeBounds
        const startTimeBoundString = timeBoundToTimeBoundString(
            startHandleTime,
            formatAsDay
        )
        return startHandleTime === rightHandleTime
            ? startTimeBoundString
            : `${startTimeBoundString}..${timeBoundToTimeBoundString(
                  rightHandleTime,
                  formatAsDay
              )}`
    }

    @computed private get countryParam() {
        if (!this.isReady) return undefined

        const authoredConfig = this.legacyConfigAsAuthored

        const originalSelectedEntityIds =
            authoredConfig.selectedData?.map((row) => row.entityId) || []
        const currentSelectedEntityIds = this.tableForSelection
            .selectedEntityIds

        const diff = difference(
            currentSelectedEntityIds,
            originalSelectedEntityIds
        )

        if (
            currentSelectedEntityIds.length !==
                originalSelectedEntityIds.length ||
            diff.length
        )
            return EntityUrlBuilder.entitiesToQueryParam(
                this.tableForSelection.selectedEntityCodesOrNames
            )

        return undefined
    }

    msPerTick = DEFAULT_MS_PER_TICK

    timelineController = new TimelineController(this)

    onPlay() {
        this.analytics.logChartTimelinePlay(this.slug)
    }

    // todo: restore this behavior??
    onStartPlayOrDrag() {
        this.debounceMode = true
        this.useTimelineDomains = true
    }

    onStopPlayOrDrag() {
        this.debounceMode = false
        this.useTimelineDomains = false
    }

    @computed get disablePlay() {
        return this.isSlopeChart
    }

    formatTime(value: Time) {
        const timeColumn = this.table.timeColumn
        if (!timeColumn) return this.table.timeColumnFormatFunction(value)
        return isMobile()
            ? timeColumn.formatValueForMobile(value)
            : timeColumn.formatValue(value)
    }

    @computed get showSmallCountriesFilterToggle() {
        return this.isScatter && this.hasCountriesSmallerThanFilterOption
    }

    @computed get showYScaleToggle() {
        if (this.isRelativeMode) return false
        if (this.isStackedArea || this.isStackedBar) return false // We currently do not have these charts with log scale
        return this.yAxis.canChangeScaleType
    }

    @computed get showZoomToggle() {
        return this.isScatter && this.tableForSelection.hasSelection
    }

    @computed get showAbsRelToggle() {
        if (!this.canToggleRelativeMode) return false
        if (this.isScatter)
            return this.xOverrideTime === undefined && this.hasTimeline
        return this.isStackedArea || this.isScatter || this.isLineChart
    }

    @computed get showHighlightToggle() {
        return this.isScatter && !!this.highlightToggle
    }

    @computed get showChangeEntityButton() {
        return !this.hideEntityControls && this.canChangeEntity
    }

    @computed get showAddEntityButton() {
        return (
            !this.hideEntityControls &&
            this.canSelectMultipleEntities &&
            (this.isLineChart || this.isStackedArea || this.isDiscreteBar)
        )
    }

    @computed get showSelectEntitiesButton() {
        return (
            !this.hideEntityControls &&
            this.addCountryMode !== EntitySelectionMode.Disabled &&
            this.numSelectableEntityNames > 1 &&
            !this.showAddEntityButton &&
            !this.showChangeEntityButton
        )
    }

    @computed get canSelectMultipleEntities() {
        if (this.numSelectableEntityNames < 2) return false
        if (this.addCountryMode === EntitySelectionMode.MultipleEntities)
            return true
        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.facetStrategy
        )
            return true

        return false
    }

    // This is just a helper method to return the correct table for providing entity choices. We want to
    // provide the root table, not the transformed table.
    // A user may have added time or other filters that would filter out all rows from certain entities, but
    // we may still want to show those entities as available in a picker. We also do not want to do things like
    // hide the Add Entity button as the user drags the timeline.
    @computed private get numSelectableEntityNames() {
        return this.inputTable.numAvailableEntityNames
    }

    @computed get canChangeEntity() {
        return (
            !this.isScatter &&
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.numSelectableEntityNames > 1
        )
    }

    @computed get startSelectingWhenLineClicked() {
        return this.showAddEntityButton
    }

    // For now I am only exposing this programmatically for the dashboard builder. Setting this to true
    // allows you to still use add country "modes" without showing the buttons in order to prioritize
    // another entity selector over the built in ones.
    @observable hideEntityControls = false
}

const defaultObject = objectWithPersistablesToObject(
    new Grapher(),
    grapherKeysToSerialize
)
