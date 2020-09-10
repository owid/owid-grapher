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
    keyBy,
    cloneDeep,
    union,
    without,
    xor,
    lastOfNonEmptyArray,
    identity,
    lowerCaseFirstLetterUnlessAbbreviation,
} from "grapher/utils/Util"
import {
    ChartType,
    GrapherTabOption,
    Color,
    TickFormattingOptions,
    EntityDimensionKey,
    ScaleType,
    StackMode,
} from "grapher/core/GrapherConstants"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import { OwidTable } from "owidTable/OwidTable"
import { EntityName, EntityId, EntityCode } from "owidTable/OwidTableConstants"
import {
    EntityDimensionInfo,
    ChartDimension,
    PersistableChartDimension,
    SourceWithDimension,
} from "grapher/chart/ChartDimension"
import { MapTransform } from "grapher/mapCharts/MapTransform"
import { GrapherUrl, GrapherQueryParams } from "./GrapherUrl"
import { StackedBarTransform } from "grapher/barCharts/StackedBarTransform"
import { DiscreteBarTransform } from "grapher/barCharts/DiscreteBarTransform"
import { StackedAreaTransform } from "grapher/areaCharts/StackedAreaTransform"
import { LineChartTransform } from "grapher/lineCharts/LineChartTransform"
import { ScatterTransform } from "grapher/scatterCharts/ScatterTransform"
import { SlopeChartTransform } from "grapher/slopeCharts/SlopeChartTransform"
import { GrapherView } from "grapher/core/GrapherView"
import { Bounds } from "grapher/utils/Bounds"
import { IChartTransform } from "grapher/chart/ChartTransform"
import { TooltipProps } from "grapher/chart/Tooltip"
import { BAKED_GRAPHER_URL, ENV, ADMIN_BASE_URL } from "settings"
import {
    minTimeFromJSON,
    maxTimeFromJSON,
    TimeBounds,
    TimeBoundValue,
    getTimeDomainFromQueryString,
    parseTimeURIComponent,
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
    GrapherConfigInterface,
    PersistableGrapher,
} from "grapher/core/GrapherConfig"
import { DimensionSlot } from "grapher/chart/DimensionSlot"
import { canBeExplorable } from "explorer/indicatorExplorer/IndicatorUtils"
import { Analytics } from "./Analytics"
import { EntityUrlBuilder } from "./EntityUrlBuilder"
import { MapProjection } from "grapher/mapCharts/MapProjections"

declare const window: any

export class Grapher extends PersistableGrapher {
    // TODO: Pass these 5 in as options, donn't get them as globals
    isDev: Readonly<boolean> = ENV === "development"
    adminBaseUrl: Readonly<string> = ADMIN_BASE_URL
    analytics: Readonly<Analytics> = new Analytics(ENV)
    isEditor: Readonly<boolean> = (window as any).isEditor === true
    bakedGrapherURL: Readonly<string> = BAKED_GRAPHER_URL

    configOnLoad: Readonly<GrapherConfigInterface>

    constructor(
        config?: GrapherConfigInterface,
        options: {
            isEmbed?: boolean
            isMediaCard?: boolean
            queryStr?: string
            globalEntitySelection?: GlobalEntitySelection
        } = {}
    ) {
        super(config)
        this.isEmbed = !!options.isEmbed
        this.isMediaCard = !!options.isMediaCard

        this.initFontSizeInAxisContainers()

        if (!this.manuallyProvideData)
            this.disposers.push(
                reaction(() => this.variableIds, this.downloadData, {
                    fireImmediately: true,
                })
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
            this.populateFromQueryParams(strToQueryParams(options.queryStr))

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

        if (this.isEditor) this.ensureValidConfig()
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
        if (time) this.setTimeFromTimeQueryParam(time)

        const endpointsOnly = params.endpointsOnly
        if (endpointsOnly !== undefined) {
            this.compareEndPointsOnly = endpointsOnly === "1" ? true : undefined
        }

        // Map stuff below

        if (this.map) {
            if (params.year) {
                const year = parseTimeURIComponent(
                    params.year,
                    TimeBoundValue.unboundedRight
                )
                this.map.targetYear = year
            }

            const region = params.region
            if (region !== undefined) {
                this.map.projection = region as MapProjection
            }
        }

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
                    const matchedEntities = this.setSelectedEntitiesByCode(
                        entityCodes
                    )
                    const notFoundEntities = Array.from(
                        matchedEntities.keys()
                    ).filter((key) => !matchedEntities.get(key))

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
    @observable isPlaying: boolean = false
    @observable.ref isSelectingData: boolean = false

    @computed get isInteractive() {
        return !this.isExporting
    }

    @action.bound toggleMinPopulationFilter() {
        this.minPopulationFilter = this.minPopulationFilter
            ? undefined
            : this.populationFilterOption
    }

    private populationFilterToggleOption: number = 1e6
    // Make the default filter toggle option reflect what is initially loaded.
    @computed get populationFilterOption() {
        if (this.minPopulationFilter)
            this.populationFilterToggleOption = this.minPopulationFilter
        return this.populationFilterToggleOption
    }

    // Checks if the data 1) is about countries and 2) has countries with less than the filter option. Used to partly determine whether to show the filter control.
    @computed get hasCountriesSmallerThanFilterOption() {
        return this.table.availableEntities.some(
            (entityName) =>
                populationMap[entityName] &&
                populationMap[entityName] < this.populationFilterOption
        )
    }

    // at startDrag, we want to show the full axis
    @observable.ref useTimelineDomains = false

    @observable userHasSetTimeline: boolean = false

    @action.bound private async downloadData() {
        if (this.externalDataUrl) {
            const json = await fetchJSON(this.externalDataUrl)
            this._receiveData(json)
            return
        }

        if (this.owidDataset) {
            this._receiveData(this.owidDataset)
            return
        }

        if (this.variableIds.length === 0) {
            // No data to download
            return
        }

        if (window.admin) {
            const json = await window.admin.getJSON(
                `/api/data/variables/${this.dataFileName}`
            )
            this._receiveData(json)
        } else {
            const json = await fetchJSON(this.dataUrl)
            this._receiveData(json)
        }
    }

    @observable.ref table: OwidTable = new OwidTable([])

    // Provide a way to insert an arbitrary element into the embed popup.
    // The "hideControls" property is a param on the explorer, so to maintain
    // modularity between the explorer and chart I am injecting the checkbox this way.
    // In the future if we merge the two we could shift to a cleaner approach.
    @observable.ref embedExplorerCheckbox?: JSX.Element

    @action.bound receiveData(json: OwidVariablesAndEntityKey) {
        this._receiveData(json)
    }

    @action.bound private _receiveData(json: OwidVariablesAndEntityKey) {
        this.table = OwidTable.fromLegacy(json)
        this.updatePopulationFilter()
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

    @observable.ref private _baseFontSize: number = 16
    @computed get baseFontSize(): number {
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
            uniq(flatten(this.filledDimensions.map((d) => d.entityNamesUniq)))
        )
    }

    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady(): boolean {
        return this.loadingVarIds.length === 0
    }

    @computed get primaryVariableId() {
        const yDimension = this.dimensions.find((d) => d.property === "y")
        return yDimension ? yDimension.variableId : undefined
    }

    @computed get primaryColumnSlug() {
        return this.primaryVariableId?.toString()
    }

    @computed private get loadingVarIds(): number[] {
        return this.dimensions
            .map((dim) => dim.variableId)
            .filter((id) => !this.table.columnsByOwidVarId.has(id))
    }

    url: GrapherUrl

    @computed get isIframe(): boolean {
        return window.self !== window.top
    }

    @computed get years() {
        return this.activeTransform.timelineYears
    }

    @computed get startYear() {
        const activeTab = this.tab
        if (activeTab === "table")
            return (
                this.dataTableTransform.autoSelectedStartYear ??
                this.timeDomain[0]
            )
        if (activeTab === "map") return this.mapTransform.targetYearProp
        return this.activeTransform.startYear!
    }

    @computed get endYear() {
        const activeTab = this.tab
        if (activeTab === "table")
            return this.multiMetricTableMode
                ? this.dataTableTransform.startYear
                : this.timeDomain[1]
        if (activeTab === "map") return this.mapTransform.targetYearProp
        return this.activeTransform.endYear!
    }

    @computed get isNativeEmbed(): boolean {
        return this.isEmbed && !this.isIframe && !this.isExporting
    }

    @computed.struct private get variableIds() {
        return uniq(this.dimensions.map((d) => d.variableId))
    }

    @computed get dataFileName(): string {
        return `${this.variableIds.join("+")}.json?v=${
            this.isEditor ? undefined : this.cacheTag
        }`
    }

    @computed get dataUrl(): string {
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
    @observable hideEntityControls: boolean = false
    externalCsvLink = ""

    @computed get hasOWIDLogo(): boolean {
        return (
            !this.hideLogo && (this.logo === undefined || this.logo === "owid")
        )
    }

    @computed get hasFatalErrors(): boolean {
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
    @action.bound ensureValidConfig() {
        const disposers = [
            autorun(() => {
                if (!this.availableTabs.includes(this.tab)) {
                    runInAction(() => (this.tab = this.availableTabs[0]))
                }
            }),
            autorun(() => {
                if (!isEqual(this.dimensions, this.validDimensions)) {
                    this.dimensions = this.validDimensions
                }
            }),
        ]
        this.disposers.push(...disposers)
    }

    // Only true if isExplorable is true and chart meets certain criteria
    @computed get isExplorableConstrained() {
        return this.isExplorable && canBeExplorable(this)
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol(): string {
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
    @action
    revertDataTableSpecificState() {
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
            if (value === "download" && this.tab === "table") {
                this.tab = this.configOnLoad.tab || "chart"
            }
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
    @computed get dimensionSlots(): DimensionSlot[] {
        const xAxis = new DimensionSlot(this, "x")
        const yAxis = new DimensionSlot(this, "y")
        const color = new DimensionSlot(this, "color")
        const size = new DimensionSlot(this, "size")

        if (this.isScatter) return [yAxis, xAxis, size, color]
        else if (this.isTimeScatter) return [yAxis, xAxis]
        else if (this.isSlopeChart) return [yAxis, size, color]
        else return [yAxis]
    }

    @computed get validDimensions() {
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
                        a: PersistableChartDimension,
                        b: PersistableChartDimension
                    ) =>
                        a.property === slot.property &&
                        a.property === b.property
                )
        })

        return validDimensions
    }

    @observable dataTableOnlyDimensions: ChartDimension[] = []

    @computed get multiMetricTableMode(): boolean {
        return this.dataTableOnlyDimensions.length > 0
    }

    @computed.struct get filledDimensions(): ChartDimension[] {
        if (!this.isReady) return []

        return this.dimensions.map(
            (dim, index) =>
                new ChartDimension(
                    dim,
                    index,
                    this.table.columnsByOwidVarId.get(dim.variableId)!
                )
        )
    }

    @computed get primaryDimensions() {
        return this.filledDimensions.filter((dim) => dim.property === "y")
    }

    @computed get displaySlug(): string {
        return this.slug ?? slugify(this.displayTitle)
    }

    @computed get availableTabs(): GrapherTabOption[] {
        return [
            this.hasChartTab && "chart",
            this.hasMapTab && "map",
            "table",
            "sources",
            "download",
        ].filter(identity) as GrapherTabOption[]
    }

    @computed get currentTitle(): string {
        let text = this.displayTitle
        const selectedEntityNames = this.selectedEntityNames

        if (
            this.primaryTab === "chart" &&
            this.addCountryMode !== "add-country" &&
            selectedEntityNames.length === 1 &&
            (!this.hideTitleAnnotation || this.canChangeEntity)
        ) {
            const entityStr = selectedEntityNames[0]
            if (entityStr.length) text = text + ", " + entityStr
        }

        if (
            !this.hideTitleAnnotation &&
            this.isLineChart &&
            this.lineChartTransform.isRelativeMode
        )
            text = "Change in " + lowerCaseFirstLetterUnlessAbbreviation(text)

        if (
            this.isReady &&
            (!this.hideTitleAnnotation ||
                (this.isLineChart &&
                    this.lineChartTransform.isSingleYear &&
                    this.lineChartTransform.hasTimeline) ||
                (this.primaryTab === "map" && this.mapTransform.hasTimeline))
        )
            text += this.timeTitleSuffix

        return text.trim()
    }

    @computed private get timeTitleSuffix() {
        const { minYear, maxYear } = this
        if (!this.table.timeColumn) return "" // Do not show year until data is loaded
        const fn = this.table.timeColumn.formatValue
        const timeFrom = fn(minYear)
        const timeTo = fn(maxYear)
        const time = timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo

        return ", " + time
    }

    @computed get maxYear(): number {
        if (this.currentTab === "table") return this.dataTableTransform.endYear
        else if (this.primaryTab === "map") return this.mapTransform.targetYear
        else if (this.isScatter && !this.scatterTransform.failMessage)
            return this.scatterTransform.endYear
        else if (this.isDiscreteBar && !this.discreteBarTransform.failMessage)
            return this.discreteBarTransform.targetYear
        else if (this.isSlopeChart) return this.slopeChartTransform.endYear
        else return this.lineChartTransform.endYear
    }

    @computed get isSingleEntity(): boolean {
        return (
            this.table.availableEntities.length === 1 ||
            this.addCountryMode === "change-country"
        )
    }

    @computed get addButtonLabel() {
        return `Add ${this.isSingleEntity ? "data" : this.entityType}`
    }

    @computed get hasFloatingAddButton(): boolean {
        return (
            this.primaryTab === "chart" &&
            !this.isExporting &&
            this.canAddData &&
            (this.isLineChart || this.isStackedArea || this.isDiscreteBar)
        )
    }

    @computed get isSingleVariable(): boolean {
        return this.primaryDimensions.length === 1
    }

    // XXX refactor into the transforms
    @computed get minYear(): number {
        if (this.currentTab === "table")
            return this.dataTableTransform.startYear
        else if (this.primaryTab === "map") return this.mapTransform.targetYear
        else if (this.isScatter && !this.scatterTransform.failMessage)
            return this.scatterTransform.startYear
        else if (this.isDiscreteBar && !this.discreteBarTransform.failMessage)
            return this.discreteBarTransform.targetYear
        else if (this.isSlopeChart) return this.slopeChartTransform.startYear
        else return this.lineChartTransform.startYear
    }

    @computed get sourcesLine(): string {
        return this.sourceDesc !== undefined
            ? this.sourceDesc
            : this.defaultSourcesLine
    }

    @computed get canAddData(): boolean {
        return (
            this.addCountryMode === "add-country" &&
            this.availableKeys.length > 1
        )
    }

    @computed get canChangeEntity(): boolean {
        return (
            !this.isScatter &&
            this.addCountryMode === "change-country" &&
            this.availableEntityNames.length > 1
        )
    }

    @computed get sourcesWithDimension(): SourceWithDimension[] {
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

    @computed private get defaultSourcesLine(): string {
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

    @computed private get defaultTitle(): string {
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

    @computed get displayTitle(): string {
        return this.title ?? this.defaultTitle
    }

    // Returns an object ready to be serialized to JSON
    @computed get object() {
        return this.toObject()
    }

    @computed get isLineChart() {
        return this.type === ChartType.LineChart
    }
    @computed get isScatter() {
        return this.type === ChartType.ScatterPlot
    }
    @computed get isTimeScatter() {
        return this.type === ChartType.TimeScatter
    }
    @computed get isStackedArea() {
        return this.type === ChartType.StackedArea
    }
    @computed get isSlopeChart() {
        return this.type === ChartType.SlopeChart
    }
    @computed get isDiscreteBar() {
        return this.type === ChartType.DiscreteBar
    }
    @computed get isStackedBar() {
        return this.type === ChartType.StackedBar
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

    @computed get selectableEntityDimensionKeys() {
        return this.activeTransform.selectableEntityDimensionKeys.map((key) =>
            this.lookupKey(key)
        )
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

    @computed get idealBounds(): Bounds {
        return this.isMediaCard
            ? new Bounds(0, 0, 1200, 630)
            : new Bounds(0, 0, 850, 600)
    }

    @computed get hasYDimension() {
        return this.dimensions.some((d) => d.property === "y")
    }

    @computed get staticSVG(): string {
        const svg = ReactDOMServer.renderToStaticMarkup(
            <GrapherView
                grapher={this}
                isExport={true}
                bounds={this.idealBounds}
            />
        )

        return svg
    }

    @computed get cacheTag(): string {
        return this.version.toString()
    }

    // todo: remove
    // Make a unique string key for an entity on a variable
    makeEntityDimensionKey(
        entityName: EntityName,
        dimensionIndex: number
    ): EntityDimensionKey {
        return `${entityName}_${dimensionIndex}`
    }

    // todo: remove
    @computed get hasSelection() {
        return this.selectedData.length > 0
    }

    // todo: remove
    @computed private get selectionData(): Array<{
        entityDimensionKey: EntityDimensionKey
        color?: Color
    }> {
        const primaryDimensions = this.primaryDimensions
        const entityIdToNameMap = this.table.entityIdToNameMap
        let validSelections = this.selectedData.filter((sel) => {
            // Must be a dimension that's on the chart
            const dimension = primaryDimensions[sel.index]
            if (!dimension) return false

            // Entity must be within that dimension
            const entityName = entityIdToNameMap.get(sel.entityId)
            if (!entityName || !dimension.entityNamesUniq.includes(entityName))
                return false

            // "change entity" charts can only have one entity selected
            if (
                this.addCountryMode === "change-country" &&
                sel.entityId !== lastOfNonEmptyArray(this.selectedData).entityId
            )
                return false

            return true
        })

        validSelections = uniqWith(
            validSelections,
            (a: any, b: any) => a.entityId === b.entityId && a.index === b.index
        )

        return validSelections.map((sel) => {
            return {
                entityDimensionKey: this.makeEntityDimensionKey(
                    entityIdToNameMap.get(sel.entityId)!,
                    sel.index
                ),
                color: sel.color,
            }
        })
    }

    // todo: remove
    selectEntityDimensionKey(key: EntityDimensionKey) {
        this.selectedKeys = this.selectedKeys.concat([key])
    }

    // todo: remove
    @computed.struct get keyColors(): {
        [entityDimensionKey: string]: Color | undefined
    } {
        const keyColors: {
            [entityDimensionKey: string]: Color | undefined
        } = {}
        this.selectionData.forEach((d) => {
            if (d.color) keyColors[d.entityDimensionKey] = d.color
        })
        return keyColors
    }

    // todo: remove
    setKeyColor(key: EntityDimensionKey, color: Color | undefined) {
        const meta = this.lookupKey(key)
        const selectedData = cloneDeep(this.selectedData)
        selectedData.forEach((d) => {
            if (d.entityId === meta.entityId && d.index === meta.index) {
                d.color = color
            }
        })
        this.selectedData = selectedData
    }

    // todo: remove
    @computed get selectedEntityNames(): EntityName[] {
        return uniq(
            this.selectedKeys.map((key) => this.lookupKey(key).entityName)
        )
    }

    // todo: remove
    @computed get availableEntityNames(): EntityName[] {
        const entitiesForDimensions = this.axisDimensions.map((dim) => {
            return this.availableKeys
                .map((key) => this.lookupKey(key))
                .filter((d) => d.dimension.variableId === dim.variableId)
                .map((d) => d.entityName)
        })

        return union(...entitiesForDimensions)
    }

    // todo: remove
    @action.bound setSingleSelectedEntity(entityId: EntityId) {
        const selectedData = cloneDeep(this.selectedData)
        selectedData.forEach((d) => (d.entityId = entityId))
        this.selectedData = selectedData
    }

    // todo: remove
    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const matchedEntities = new Map<string, boolean>()
        entityCodes.forEach((code) => matchedEntities.set(code, false))
        if (this.canChangeEntity) {
            this.availableEntityNames.forEach((entityName) => {
                const entityId = this.table.entityNameToIdMap.get(entityName)!
                const entityCode = this.table.entityNameToCodeMap.get(
                    entityName
                )
                if (
                    entityCode === entityCodes[0] ||
                    entityName === entityCodes[0]
                ) {
                    matchedEntities.set(entityCodes[0], true)
                    this.setSingleSelectedEntity(entityId)
                }
            })
        } else {
            this.selectedKeys = this.availableKeys.filter((key) => {
                const meta = this.lookupKey(key)
                const entityName = meta.entityName
                const entityCode = this.table.entityNameToCodeMap.get(
                    entityName
                )
                return [meta.shortCode, entityCode, entityName]
                    .map((key) => {
                        if (!matchedEntities.has(key!)) return false
                        matchedEntities.set(key!, true)
                        return true
                    })
                    .some((item) => item)
            })
        }
        return matchedEntities
    }

    // todo: remove
    @action.bound resetSelectedEntities() {
        this.selectedData = this.configOnLoad.selectedData || []
    }

    // todo: remove
    @computed get selectedEntityCodes(): EntityCode[] {
        return uniq(this.selectedKeys.map((k) => this.lookupKey(k).shortCode))
    }

    // todo: remove
    deselect(entityDimensionKey: EntityDimensionKey) {
        this.selectedKeys = this.selectedKeys.filter(
            (e) => e !== entityDimensionKey
        )
    }

    // todo: remove
    @computed get selectedKeys(): EntityDimensionKey[] {
        return this.selectionData.map((d) => d.entityDimensionKey)
    }

    // remove
    // Map keys back to their components for storage
    set selectedKeys(keys: EntityDimensionKey[]) {
        if (!this.isReady) return

        const selection = keys.map((key) => {
            const { entityName: entity, index } = this.lookupKey(key)
            return {
                entityId: this.table.entityNameToIdMap.get(entity)!,
                index: index,
                color: this.keyColors[key],
            }
        })
        this.selectedData = selection
    }

    selectOnlyThisEntity(entityName: string) {
        const keys = this.availableKeysByEntity.get(entityName)
        if (keys?.length) this.selectedKeys = keys
    }

    toggleEntitySelectionStatus(entityName: string) {
        const keys = this.availableKeysByEntity.get(entityName)
        if (keys?.length) this.selectedKeys = xor(keys, this.selectedKeys)
    }

    // todo: remove
    @computed get selectedKeysByKey(): {
        [entityDimensionKey: string]: EntityDimensionKey
    } {
        return keyBy(this.selectedKeys)
    }

    // todo: remove this
    // Calculate the available entityDimensionKeys and their associated info
    @computed get entityDimensionMap(): Map<
        EntityDimensionKey,
        EntityDimensionInfo
    > {
        if (!this.isReady) return new Map()
        const { isSingleEntity, isSingleVariable } = this
        const primaryDimensions = this.primaryDimensions

        const keyData = new Map<EntityDimensionKey, EntityDimensionInfo>()
        primaryDimensions.forEach((dimension, dimensionIndex) => {
            dimension.entityNamesUniq.forEach((entityName) => {
                const entityCode = this.table.entityNameToCodeMap.get(
                    entityName
                )
                const entityId = this.table.entityNameToIdMap.get(entityName)!
                const entityDimensionKey = this.makeEntityDimensionKey(
                    entityName,
                    dimensionIndex
                )

                // Full label completely represents the data in the key and is used in the editor
                const fullLabel = `${entityName} - ${dimension.displayName}`

                // The output label however is context-dependent
                let label = fullLabel
                if (isSingleVariable) {
                    label = entityName
                } else if (isSingleEntity) {
                    label = `${dimension.displayName}`
                }

                keyData.set(entityDimensionKey, {
                    entityDimensionKey,
                    entityId,
                    entityName: entityName,
                    dimension,
                    index: dimensionIndex,
                    fullLabel,
                    label,
                    shortCode:
                        primaryDimensions.length > 1 &&
                        this.addCountryMode !== "change-country"
                            ? `${entityCode || entityName}-${dimension.index}`
                            : entityCode || entityName,
                })
            })
        })

        return keyData
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

    // todo: remove
    @computed.struct get availableKeys(): EntityDimensionKey[] {
        return sortBy(Array.from(this.entityDimensionMap.keys()))
    }

    // todo: remove
    @computed.struct get remainingKeys(): EntityDimensionKey[] {
        const { availableKeys, selectedKeys } = this
        return without(availableKeys, ...selectedKeys)
    }

    // todo: remove
    @computed get availableKeysByEntity(): Map<
        EntityName,
        EntityDimensionKey[]
    > {
        const keysByEntity = new Map()
        this.entityDimensionMap.forEach((info, key) => {
            const keys = keysByEntity.get(info.entityName) || []
            keys.push(key)
            keysByEntity.set(info.entityName, keys)
        })
        return keysByEntity
    }

    // todo: remove
    lookupKey(key: EntityDimensionKey): EntityDimensionInfo {
        const keyDatum = this.entityDimensionMap.get(key)
        if (keyDatum !== undefined) return keyDatum
        else throw new Error(`Unknown data key: ${key}`)
    }

    // todo: remove
    getLabelForKey(key: EntityDimensionKey): string {
        return this.lookupKey(key).label
    }

    // todo: remove
    toggleKey(key: EntityDimensionKey) {
        if (this.selectedKeys.includes(key)) {
            this.selectedKeys = this.selectedKeys.filter((k) => k !== key)
        } else {
            this.selectedKeys = this.selectedKeys.concat([key])
        }
    }
}
