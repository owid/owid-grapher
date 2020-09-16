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
    when,
} from "mobx"
import { bind } from "decko"

import {
    uniqWith,
    isEqual,
    formatDay,
    formatYear,
    uniq,
    fetchJSON,
    flatten,
    sortBy,
    getErrorMessageRelatedQuestionUrl,
    slugify,
    identity,
    lowerCaseFirstLetterUnlessAbbreviation,
} from "grapher/utils/Util"
import {
    ChartTypes,
    GrapherTabOption,
    TickFormattingOptions,
    ScaleType,
    StackMode,
    DimensionProperty,
    ChartTypeName,
    AddCountryMode,
    HighlightToggleConfig,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    Time,
} from "grapher/core/GrapherConstants"
import { LegacyVariablesAndEntityKey } from "owidTable/LegacyVariableCode"
import { OwidTable } from "owidTable/OwidTable"
import {
    ChartDimension,
    SourceWithDimension,
    ChartDimensionInterface,
} from "grapher/chart/ChartDimension"
import { MapTransform } from "grapher/mapCharts/MapTransform"
import {
    GrapherQueryParams,
    GrapherUrl,
    legacyQueryParamsToCurrentQueryParams,
} from "./GrapherUrl"
import { StackedBarTransform } from "grapher/barCharts/StackedBarTransform"
import { DiscreteBarTransform } from "grapher/barCharts/DiscreteBarTransform"
import { StackedAreaTransform } from "grapher/areaCharts/StackedAreaTransform"
import { LineChartTransform } from "grapher/lineCharts/LineChartTransform"
import { ScatterTransform } from "grapher/scatterCharts/ScatterTransform"
import { SlopeChartTransform } from "grapher/slopeCharts/SlopeChartTransform"
import { GrapherView } from "grapher/core/GrapherView"
import { Bounds } from "grapher/utils/Bounds"
import { IChartTransform } from "grapher/chart/ChartTransform"
import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { BAKED_GRAPHER_URL, ENV, ADMIN_BASE_URL } from "settings"
import {
    minTimeFromJSON,
    maxTimeFromJSON,
    TimeBounds,
    TimeBoundValue,
    getTimeDomainFromQueryString,
    TimeBound,
    minTimeToJSON,
    maxTimeToJSON,
} from "grapher/utils/TimeBounds"
import {
    GlobalEntitySelection,
    subscribeGrapherToGlobalEntitySelection,
} from "site/globalEntityControl/GlobalEntitySelection"
import { countries } from "utils/countries"
import { DataTableTransform } from "grapher/dataTable/DataTableTransform"
import { getWindowQueryParams, strToQueryParams } from "utils/client/url"
import { populationMap } from "owidTable/PopulationMap"
import {
    GrapherInterface,
    LegacyGrapherInterface,
} from "grapher/core/GrapherInterface"
import { DimensionSlot } from "grapher/chart/DimensionSlot"
import { canBeExplorable } from "explorer/indicatorExplorer/IndicatorUtils"
import { Analytics } from "./Analytics"
import { EntityUrlBuilder } from "./EntityUrlBuilder"
import { MapProjection } from "grapher/mapCharts/MapProjections"
import { LogoOption } from "grapher/chart/Logos"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import { MapConfig } from "grapher/mapCharts/MapConfig"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import {
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    updatePersistables,
} from "grapher/persistable/Persistable"
import { TimeViz } from "grapher/timeline/TimelineController"
import { EntityId, EntityName } from "owidTable/OwidTableConstants"

declare const window: any

class GrapherDefaults implements GrapherInterface {
    @observable.ref type: ChartTypeName = "LineChart"
    @observable.ref isExplorable: boolean = false
    @observable.ref id?: number = undefined
    @observable.ref version: number = 1
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle: string = ""
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note: string = ""
    @observable.ref hideTitleAnnotation?: true = undefined
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined
    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined
    @observable.ref addCountryMode: AddCountryMode = "add-country"
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: StackMode = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle?: boolean = true
    @observable.ref entityType: string = "country"
    @observable.ref entityTypePlural: string = "countries"
    @observable.ref hideTimeline?: true = undefined
    @observable.ref zoomToSelection?: true = undefined
    @observable.ref minPopulationFilter?: number = undefined
    @observable.ref showYearLabels?: boolean = undefined // Always show year in labels for bar charts
    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: GrapherTabOption = "chart"
    @observable.ref overlay?: GrapherTabOption = undefined
    @observable.ref internalNotes: string = ""
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl: string = ""
    @observable.ref isPublished?: true = undefined
    @observable.ref baseColorScheme?: string = undefined
    @observable.ref invertColorScheme?: true = undefined
    @observable.ref hideLinesOutsideTolerance?: true = undefined
    @observable hideConnectedScatterLines?: boolean = undefined // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: true = undefined
    @observable.ref matchingEntitiesOnly?: true = undefined

    @observable.ref xAxis = new AxisConfig()
    @observable.ref yAxis = new AxisConfig()
    @observable colorScale = new ColorScaleConfig()
    @observable map = new MapConfig()
    @observable.ref dimensions: ChartDimension[] = []

    @observable selectedEntityNames: EntityName[] = []
    @observable selectedEntityIds: EntityId[] = []
    @observable excludedEntities?: number[] = undefined
    @observable comparisonLines: ComparisonLineConfig[] = [] // todo: Persistables?
    @observable relatedQuestions?: RelatedQuestionsConfig[] // todo: Persistables?

    externalDataUrl?: string = undefined // This is temporarily used for testing legacy prod charts locally. Will be removed
    owidDataset?: LegacyVariablesAndEntityKey = undefined // This is temporarily used for testing. Will be removed
    manuallyProvideData?: boolean = false // This will be removed.
}

const defaultObject = objectWithPersistablesToObject(new GrapherDefaults())

const legacyConfigToConfig = (
    config: LegacyGrapherInterface | GrapherInterface
): GrapherInterface => {
    const legacyConfig = config as LegacyGrapherInterface
    if (!legacyConfig.selectedData) return legacyConfig

    const newConfig = legacyConfig as GrapherInterface
    newConfig.selectedEntityIds = legacyConfig.selectedData.map(
        (row) => row.entityId
    )
    return newConfig
}

export class Grapher extends GrapherDefaults implements TimeViz {
    // TODO: Pass these 5 in as options, donn't get them as globals
    isDev: Readonly<boolean> = ENV === "development"
    adminBaseUrl: Readonly<string> = ADMIN_BASE_URL
    analytics: Readonly<Analytics> = new Analytics(ENV)
    isEditor: Readonly<boolean> = (window as any).isEditor === true
    bakedGrapherURL: Readonly<string> = BAKED_GRAPHER_URL

    configOnLoad: Readonly<GrapherInterface>
    @observable.ref table: OwidTable

    constructor(
        legacyConfig?: LegacyGrapherInterface | GrapherInterface,
        options: {
            isEmbed?: boolean
            isMediaCard?: boolean
            queryStr?: string
            globalEntitySelection?: GlobalEntitySelection
        } = {}
    ) {
        super()
        this.table = new OwidTable([])
        const config = legacyConfig
            ? legacyConfigToConfig(legacyConfig)
            : legacyConfig
        this.updateFromObject(config)
        this.isEmbed = !!options.isEmbed
        this.isMediaCard = !!options.isMediaCard

        this.initFontSizeInAxisContainers()

        if (this.owidDataset) this._receiveLegacyData(this.owidDataset)
        else if (this.externalDataUrl)
            this.downloadLegacyDataFromUrl(this.externalDataUrl)
        else if (!this.manuallyProvideData)
            this.disposers.push(
                reaction(
                    () => this.variableIds,
                    this.downloadLegacyDataFromOwidVariableIds,
                    {
                        fireImmediately: true,
                    }
                )
            )

        this.disposers.push(
            reaction(
                () => this.minPopulationFilter,
                () => {
                    this.updatePopulationFilter()
                }
            )
        )

        this.url = new GrapherUrl(this, config, this.bakedGrapherURL)

        if (options.queryStr !== undefined)
            this.populateFromQueryParams(
                legacyQueryParamsToCurrentQueryParams(
                    strToQueryParams(options.queryStr)
                )
            )

        // The props after consuming the URL parameters, but before any user interaction
        this.configOnLoad = this.toObject()

        if (options.globalEntitySelection) {
            this.disposers.push(
                subscribeGrapherToGlobalEntitySelection(
                    this,
                    options.globalEntitySelection
                )
            )
        }

        if (this.isEditor) this.ensureValidConfigWhenEditing()
    }

    toObject() {
        const obj: GrapherInterface = objectWithPersistablesToObject(this)

        if (this.table.hasSelection)
            obj.selectedEntityNames = this.table.selectedEntityNames

        // Never save the followingto the DB.
        delete obj.externalDataUrl
        delete obj.owidDataset
        delete obj.manuallyProvideData

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        delete obj.overlay

        deleteRuntimeAndUnchangedProps(obj, defaultObject)

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        return obj
    }

    @action.bound updateFromObject(obj?: GrapherInterface) {
        if (!obj) return

        updatePersistables(this, obj)

        // Regression fix: some legacies have this set to Null. Todo: clean DB.
        if (obj.originUrl === null) this.originUrl = ""

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) this.minTime = minTimeFromJSON(obj.minTime)
        if (obj.maxTime) this.maxTime = maxTimeFromJSON(obj.maxTime)

        // Todo: remove once we are more RAII.
        if (obj?.dimensions?.length)
            this.setDimensionsFromConfigs(obj.dimensions)
    }

    /**
     * Applies query parameters to the grapher config
     */
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
        if (region !== undefined) this.map.projection = region as MapProjection

        // Selected countries -- we can't actually look these up until we have the data
        const country = params.country
        if (
            this.manuallyProvideData ||
            !country ||
            this.addCountryMode === "disabled"
        )
            return
        when(
            () => this.isReady,
            () => {
                runInAction(() => {
                    const entityCodes = EntityUrlBuilder.queryParamToEntities(
                        country
                    )
                    const matchedEntities = new Set(
                        this.table.setSelectedEntitiesByCode(entityCodes)
                    )

                    const notFoundEntities = entityCodes.filter(
                        (code) => !matchedEntities.has(code)
                    )
                    if (notFoundEntities.length)
                        this.analytics.logEntitiesNotFoundError(
                            notFoundEntities
                        )
                })
            }
        )
    }

    setTimeFromTimeQueryParam(time: string) {
        this.timeDomain = getTimeDomainFromQueryString(time)
    }

    @observable.ref isEmbed: boolean
    @observable.ref isMediaCard: boolean
    @observable.ref isExporting?: boolean
    @observable.ref tooltip?: TooltipProps
    @observable isPlaying = false
    @observable.ref isSelectingData = false

    @computed get isInteractive() {
        return !this.isExporting
    }

    @action.bound toggleMinPopulationFilter() {
        this.minPopulationFilter = this.minPopulationFilter
            ? undefined
            : this.populationFilterOption
    }

    private populationFilterToggleOption = 1e6
    // Make the default filter toggle option reflect what is initially loaded.
    @computed get populationFilterOption() {
        if (this.minPopulationFilter)
            this.populationFilterToggleOption = this.minPopulationFilter
        return this.populationFilterToggleOption
    }

    // Checks if the data 1) is about countries and 2) has countries with less than the filter option. Used to partly determine whether to show the filter control.
    @computed get hasCountriesSmallerThanFilterOption() {
        return this.table.availableEntityNames.some(
            (entityName) =>
                populationMap[entityName] &&
                populationMap[entityName] < this.populationFilterOption
        )
    }

    // at startDrag, we want to show the full axis
    @observable.ref useTimelineDomains = false

    @observable userHasSetTimeline = false

    @action.bound private async downloadLegacyDataFromUrl(url: string) {
        const json = await fetchJSON(url)
        this._receiveLegacyData(json)
    }

    @action.bound private async downloadLegacyDataFromOwidVariableIds() {
        if (this.variableIds.length === 0)
            // No data to download
            return

        try {
            if (window.admin) {
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

    // Provide a way to insert an arbitrary element into the embed popup.
    // The "hideControls" property is a param on the explorer, so to maintain
    // modularity between the explorer and chart I am injecting the checkbox this way.
    // In the future if we merge the two we could shift to a cleaner approach.
    @observable.ref embedExplorerCheckbox?: JSX.Element

    @action.bound receiveLegacyData(json: LegacyVariablesAndEntityKey) {
        this._receiveLegacyData(json)
    }

    @action.bound applyLegacyUnitConversionFactors() {
        const table = this.table
        table.columnsAsArray
            .filter((col) => col.display.conversionFactor !== undefined)
            .forEach((col) => {
                table.addLegacyColumnFromUnitConversion(
                    col.display.conversionFactor!,
                    col.spec.owidVariableId!
                )
            })

        this.dimensions
            .filter((dim) => dim.display?.conversionFactor !== undefined)
            .forEach((dimension) => {
                table.addLegacyColumnFromUnitConversion(
                    dimension.display!.conversionFactor!,
                    dimension.variableId
                )
            })
    }

    @action.bound private _receiveLegacyData(
        json: LegacyVariablesAndEntityKey
    ) {
        const { table } = this
        table.loadFromLegacy(json)

        this.applyLegacyUnitConversionFactors()

        if (this.selectedEntityIds.length)
            table.setSelectedEntitiesByEntityId(this.selectedEntityIds)
        else if (this.selectedEntityNames.length)
            table.setSelectedEntities(this.selectedEntityNames)
        // Todo: load colors
        this.updatePopulationFilter() // todo: remove
    }

    // todo: refactor
    @computed get selectedCountryNames() {
        // Get the countries that are already selected
        let countryCodes = EntityUrlBuilder.queryParamToEntities(
            this.url?.params.country || ""
        )
        // Get the countries from the url
        countryCodes = countryCodes.concat(
            EntityUrlBuilder.queryParamToEntities(
                getWindowQueryParams().country || ""
            )
        )
        return new Set<string>(
            countryCodes
                .map((code) =>
                    countries.find((country) => country.code === code)
                )
                .filter((i) => i)
                .map((c) => c!.name)
        )
    }

    @observable.ref private _baseFontSize = 16

    @computed get baseFontSize() {
        if (this.isMediaCard) return 24
        else if (this.isExporting) return 18
        else return this._baseFontSize
    }

    set baseFontSize(val: number) {
        this._baseFontSize = val
    }

    @computed get formatYearTickFunction() {
        return this.table.hasDayColumn
            ? (day: number, options?: TickFormattingOptions) =>
                  formatDay(
                      day,
                      options?.isFirstOrLastTick ? {} : { format: "MMM D" }
                  )
            : formatYear
    }

    @computed get sortedUniqueEntitiesAcrossDimensions() {
        return sortBy(
            uniq(
                flatten(
                    this.filledDimensions.map(
                        (dim) => dim.column.entityNamesUniqArr
                    )
                )
            )
        )
    }

    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady() {
        return this.loadingDimensions.length === 0
    }

    @computed get primaryVariableId() {
        const yDimension = this.dimensions.find((d) => d.property === "y")
        return yDimension ? yDimension.variableId : undefined
    }

    @computed get primaryColumnSlug() {
        return this.primaryVariableId?.toString()
    }

    @computed private get loadingDimensions() {
        return this.dimensions.filter((dim) => !dim.isLoaded)
    }

    url: GrapherUrl

    @computed get isIframe() {
        return window.self !== window.top
    }

    // todo: remove ifs
    @computed get times(): Time[] {
        if (this.tab === "map") return this.mapTransform.timelineTimes
        return this.activeTransform.timelineTimes
    }

    // todo: remove ifs
    @computed get startTime(): Time {
        const activeTab = this.tab
        if (activeTab === "table")
            return (
                this.dataTableTransform.autoSelectedStartTime ??
                this.timeDomain[0]
            )
        else if (activeTab === "map") return this.mapTransform.endTimelineTime // todo: always use endTimelineTime for maps?
        return this.activeTransform.startTimelineTime!
    }

    // todo: remove ifs
    set startTime(newValue: Time) {
        if (this.tab === "map") this.timeDomain = [newValue, newValue]
        else this.timeDomain = [newValue, this.timeDomain[1]]
    }

    // todo: remove ifs
    set endTime(value: Time) {
        const activeTab = this.tab
        if (activeTab === "map" || activeTab === "table")
            this.timeDomain = [value, value]
        else this.timeDomain = [this.timeDomain[0], value]
    }

    // todo: remove ifs
    @computed get endTime(): Time {
        const activeTab = this.tab
        if (activeTab === "table")
            return this.multiMetricTableMode
                ? this.dataTableTransform.startTimelineTime
                : this.timeDomain[1]
        else if (activeTab === "map") return this.mapTransform.endTimelineTime
        return this.activeTransform.endTimelineTime!
    }

    @computed get isNativeEmbed() {
        return this.isEmbed && !this.isIframe && !this.isExporting
    }

    @computed.struct private get variableIds() {
        return uniq(this.dimensions.map((d) => d.variableId))
    }

    @computed get dataFileName() {
        return `${this.variableIds.join("+")}.json?v=${
            this.isEditor ? undefined : this.cacheTag
        }`
    }

    @computed get dataUrl() {
        return `${this.bakedGrapherURL}/data/variables/${this.dataFileName}`
    }

    @computed get showAddEntityControls() {
        return !this.hideEntityControls && this.canAddData
    }

    @computed get areMarksClickable() {
        return this.showAddEntityControls
    }

    // For now I am only exposing this programmatically for the dashboard builder. Setting this to true
    // allows you to still use add country "modes" without showing the buttons in order to prioritize
    // another entity selector over the built in ones.
    @observable hideEntityControls = false
    externalCsvLink = ""

    @computed get hasOWIDLogo() {
        return (
            !this.hideLogo && (this.logo === undefined || this.logo === "owid")
        )
    }

    @computed get hasFatalErrors() {
        const { relatedQuestions } = this
        return (
            relatedQuestions?.some(
                (question) => !!getErrorMessageRelatedQuestionUrl(question)
            ) || false
        )
    }

    disposers: IReactionDisposer[] = []

    @bind dispose() {
        this.disposers.forEach((dispose) => dispose())
    }

    private initFontSizeInAxisContainers() {
        // Todo: there is probably a cleaner way to pass fontSize in.
        const that = this
        const axisContainer = {
            get fontSize() {
                return that.baseFontSize
            },
        }
        this.xAxis.container = axisContainer
        this.yAxis.container = axisContainer
    }

    updatePopulationFilter() {
        const slug = "pop_filter"
        const minPop = this.minPopulationFilter
        if (!minPop) this.table.deleteColumnBySlug(slug)
        else
            this.table.addFilterColumn(slug, (row, index, table) => {
                const name = row.entityName
                const pop = populationMap[name]
                return !pop || pop >= minPop || table!.isSelected(row)
            })
    }

    // todo: can we remove this?
    // I believe these states can only occur during editing.
    @action.bound private ensureValidConfigWhenEditing() {
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
                    (a: ChartDimensionInterface, b: ChartDimensionInterface) =>
                        a.property === slot.property &&
                        a.property === b.property
                )
        })

        return validDimensions
    }

    // Only true if isExplorable is true and chart meets certain criteria
    @computed get isExplorableConstrained() {
        return this.isExplorable && canBeExplorable(this)
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol() {
        let url = this.originUrl
        if (!url.startsWith("http")) url = `https://${url}`
        return url
    }

    @computed get primaryTab() {
        return this.tab
    }
    @computed get overlayTab() {
        return this.overlay
    }

    /** TEMPORARY: Needs to be replaced with declarative filter columns ASAP */
    private chartMinPopulationFilter?: number = undefined

    @action.bound private revertDataTableSpecificState() {
        /** If the start year was autoselected in the DataTable, revert. */
        if (!this.userHasSetTimeline)
            this.timeDomain = [
                this.configOnLoad.minTime ?? TimeBoundValue.unboundedLeft,
                this.timeDomain[1],
            ]

        /** Revert the state of minPopulationFilter */
        this.minPopulationFilter = this.chartMinPopulationFilter
    }

    @computed get currentTab() {
        return this.overlay ? this.overlay : this.tab
    }

    /** TEMPORARY: Needs to be replaced with declarative filter columns ASAP */
    set currentTab(value) {
        if (this.tab === "chart")
            this.chartMinPopulationFilter = this.minPopulationFilter
        if (this.tab === "table" && value !== "table")
            this.revertDataTableSpecificState()

        if (value === "chart" || value === "map" || value === "table") {
            this.tab = value
            this.overlay = undefined
        } else {
            // table tab cannot be downloaded, so revert to default tab
            if (value === "download" && this.tab === "table")
                this.tab = this.configOnLoad.tab || "chart"
            this.overlay = value
        }
    }

    @computed get timeDomain(): TimeBounds {
        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeFromJSON(this.minTime),
            maxTimeFromJSON(this.maxTime),
        ]
    }

    set timeDomain(value: TimeBounds) {
        this.minTime = value[0]
        this.maxTime = value[1]
    }

    // Get the dimension slots appropriate for this type of chart
    @computed get dimensionSlots() {
        const xAxis = new DimensionSlot(this, "x")
        const yAxis = new DimensionSlot(this, "y")
        const color = new DimensionSlot(this, "color")
        const size = new DimensionSlot(this, "size")

        if (this.isScatter) return [yAxis, xAxis, size, color]
        else if (this.isTimeScatter) return [yAxis, xAxis]
        else if (this.isSlopeChart) return [yAxis, size, color]
        return [yAxis]
    }

    @observable dataTableOnlyDimensions: ChartDimension[] = []

    @computed get multiMetricTableMode() {
        return this.dataTableOnlyDimensions.length > 0
    }

    @computed.struct get filledDimensions() {
        return this.isReady ? this.dimensions : []
    }

    @action.bound addDimension(config: ChartDimensionInterface) {
        this.dimensions.push(new ChartDimension(config, this.table))
    }

    @action.bound setDimensionsForProperty(
        property: DimensionProperty,
        newConfigs: ChartDimensionInterface[]
    ) {
        let newDimensions: ChartDimension[] = []
        this.dimensionSlots.forEach((slot) => {
            if (slot.property === property)
                newDimensions = newDimensions.concat(
                    newConfigs.map(
                        (config) => new ChartDimension(config, this.table)
                    )
                )
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.dimensions = newDimensions
    }

    @action.bound setDimensionsFromConfigs(configs: ChartDimensionInterface[]) {
        this.dimensions = configs.map(
            (config) => new ChartDimension(config, this.table)
        )
    }

    @computed get primaryDimensions() {
        return this.filledDimensions.filter((dim) => dim.property === "y")
    }

    @computed get displaySlug() {
        return this.slug ?? slugify(this.displayTitle)
    }

    @computed get availableTabs() {
        return [
            this.hasChartTab && "chart",
            this.hasMapTab && "map",
            "table",
            "sources",
            "download",
        ].filter(identity) as GrapherTabOption[]
    }

    @computed get currentTitle() {
        let text = this.displayTitle
        const selectedEntityNames = this.table.selectedEntityNames

        if (
            this.primaryTab === "chart" &&
            this.addCountryMode !== "add-country" &&
            selectedEntityNames.length === 1 &&
            (!this.hideTitleAnnotation || this.canChangeEntity)
        ) {
            const entityStr = selectedEntityNames[0]
            if (entityStr.length) text = `${text}, ${entityStr}`
        }

        if (
            !this.hideTitleAnnotation &&
            this.isLineChart &&
            this.isRelativeMode
        )
            text = "Change in " + lowerCaseFirstLetterUnlessAbbreviation(text)

        if (
            this.isReady &&
            (!this.hideTitleAnnotation ||
                (this.isLineChart &&
                    this.lineChartTransform.isSingleTime &&
                    this.lineChartTransform.hasTimeline) ||
                (this.primaryTab === "map" && this.mapTransform.hasTimeline))
        )
            text += this.timeTitleSuffix

        return text.trim()
    }

    @computed private get timeTitleSuffix() {
        if (!this.table.timeColumn) return "" // Do not show year until data is loaded
        const { startTime, endTime } = this
        const fn = this.table.timeColumn.formatValue
        const timeFrom = fn(startTime)
        const timeTo = fn(endTime)
        const time = timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo

        return ", " + time
    }

    @computed get isSingleEntity() {
        return (
            this.table.availableEntityNames.length === 1 ||
            this.addCountryMode === "change-country"
        )
    }

    @computed get addButtonLabel() {
        return `Add ${this.isSingleEntity ? "data" : this.entityType}`
    }

    @computed get hasFloatingAddButton() {
        return (
            this.primaryTab === "chart" &&
            !this.isExporting &&
            this.canAddData &&
            (this.isLineChart || this.isStackedArea || this.isDiscreteBar)
        )
    }

    @computed get isSingleVariable() {
        return this.primaryDimensions.length === 1
    }

    @computed get sourcesLine() {
        return this.sourceDesc !== undefined
            ? this.sourceDesc
            : this.defaultSourcesLine
    }

    @computed get canAddData() {
        return (
            this.addCountryMode === "add-country" &&
            this.table.availableEntityNames.length > 1
        )
    }

    @computed get canChangeEntity() {
        return (
            !this.isScatter &&
            this.addCountryMode === "change-country" &&
            this.table.availableEntityNames.length > 1
        )
    }

    @computed get sourcesWithDimension() {
        const { filledDimensions } = this

        const sources: SourceWithDimension[] = []
        filledDimensions.forEach((dim) => {
            const { column } = dim
            // HACK (Mispy): Ignore the default color source on scatterplots.
            if (
                column.name !== "Countries Continents" &&
                column.name !== "Total population (Gapminder)"
            )
                sources.push({ source: column.source!, dimension: dim })
        })
        return sources
    }

    @computed private get defaultSourcesLine() {
        let sourceNames = this.sourcesWithDimension.map(
            (source) => source.source?.name || ""
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

    @computed get axisDimensions() {
        return this.filledDimensions.filter(
            (dim) => dim.property === "y" || dim.property === "x"
        )
    }

    @computed private get defaultTitle() {
        const { primaryDimensions } = this
        if (this.isScatter)
            return this.axisDimensions.map((d) => d.displayName).join(" vs. ")
        else if (
            primaryDimensions.length > 1 &&
            uniq(primaryDimensions.map((d) => d.column.datasetName)).length ===
                1
        )
            return primaryDimensions[0].column.datasetName!
        else if (primaryDimensions.length === 2)
            return primaryDimensions.map((d) => d.displayName).join(" and ")
        else return primaryDimensions.map((d) => d.displayName).join(", ")
    }

    @computed get displayTitle() {
        return this.title ?? this.defaultTitle
    }

    // Returns an object ready to be serialized to JSON
    @computed get object() {
        return this.toObject()
    }

    @computed get isLineChart() {
        return this.type === ChartTypes.LineChart
    }
    @computed get isScatter() {
        return this.type === ChartTypes.ScatterPlot
    }
    @computed get isTimeScatter() {
        return this.type === ChartTypes.TimeScatter
    }
    @computed get isStackedArea() {
        return this.type === ChartTypes.StackedArea
    }
    @computed get isSlopeChart() {
        return this.type === ChartTypes.SlopeChart
    }
    @computed get isDiscreteBar() {
        return this.type === ChartTypes.DiscreteBar
    }
    @computed get isStackedBar() {
        return this.type === ChartTypes.StackedBar
    }

    // WARNING: ALL OF THESE WILL BE REMOVED!!!! DO NOT USE
    @computed get lineChartTransform() {
        return new LineChartTransform(this)
    }
    @computed get scatterTransform() {
        return new ScatterTransform(this)
    }
    @computed get stackedAreaTransform() {
        return new StackedAreaTransform(this)
    }
    @computed get slopeChartTransform() {
        return new SlopeChartTransform(this)
    }
    @computed get discreteBarTransform() {
        return new DiscreteBarTransform(this)
    }
    @computed get stackedBarTransform() {
        return new StackedBarTransform(this)
    }
    @computed get mapTransform() {
        return new MapTransform(this)
    }
    @computed get dataTableTransform() {
        return new DataTableTransform(this)
    }

    @computed get activeColorScale() {
        return this.activeTransform.colorScale
    }

    // WARNING: THIS WILL BE REMOVED!!!! DO NOT USE
    @computed private get activeTransform(): IChartTransform {
        if (this.currentTab === "table") return this.dataTableTransform
        else if (this.isLineChart) return this.lineChartTransform
        else if (this.isScatter || this.isTimeScatter)
            return this.scatterTransform
        else if (this.isStackedArea) return this.stackedAreaTransform
        else if (this.isSlopeChart) return this.slopeChartTransform
        else if (this.isDiscreteBar) return this.discreteBarTransform
        else if (this.isStackedBar) return this.stackedBarTransform
        else throw new Error("No transform found")
    }

    @computed get idealBounds() {
        return this.isMediaCard
            ? new Bounds(0, 0, 1200, 630)
            : new Bounds(0, 0, 850, 600)
    }

    @computed get hasYDimension() {
        return this.dimensions.some((d) => d.property === "y")
    }

    @computed get staticSVG() {
        return ReactDOMServer.renderToStaticMarkup(
            <GrapherView
                grapher={this}
                isExport={true}
                bounds={this.idealBounds}
            />
        )
    }

    @computed get cacheTag() {
        return this.version.toString()
    }

    // NB: The timeline scatterplot in relative mode calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
        return this.stackMode === "relative"
    }

    @action.bound toggleRelativeMode() {
        this.stackMode = !this.isRelativeMode ? "relative" : "absolute"
    }

    @computed get canToggleRelativeMode(): boolean {
        return !this.hideRelativeToggle
    }
}
