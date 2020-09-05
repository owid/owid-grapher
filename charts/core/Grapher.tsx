import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import {
    observable,
    computed,
    action,
    autorun,
    toJS,
    runInAction,
    reaction,
    IReactionDisposer
} from "mobx"
import { bind } from "decko"

import {
    extend,
    map,
    filter,
    includes,
    uniqWith,
    isEqual,
    defaultTo,
    formatDay,
    formatYear,
    uniq,
    fetchJSON,
    flatten,
    sortBy,
    getErrorMessageRelatedQuestionUrl,
    slugify,
    each,
    keyBy,
    cloneDeep,
    union,
    without,
    xor,
    lastOfNonEmptyArray,
    find
} from "charts/utils/Util"
import { AxisOptions, AxisContainerOptions } from "charts/axis/Axis"
import {
    ChartType,
    GrapherTabOption,
    Color,
    TickFormattingOptions,
    EntityDimensionKey
} from "charts/core/GrapherConstants"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import {
    OwidTable,
    EntityName,
    EntityId,
    EntityCode
} from "owidTable/OwidTable"
import {
    EntityDimensionInfo,
    ChartDimension,
    ChartDimensionSpec,
    ChartDimensionInterface,
    SourceWithDimension
} from "charts/chart/ChartDimension"
import { MapConfig } from "charts/mapCharts/MapConfig"
import { MapTransform } from "charts/mapCharts/MapTransform"
import { GrapherUrl, EntityUrlBuilder } from "./GrapherUrl"
import { StackedBarTransform } from "charts/barCharts/StackedBarTransform"
import { DiscreteBarTransform } from "charts/barCharts/DiscreteBarTransform"
import { StackedAreaTransform } from "charts/areaCharts/StackedAreaTransform"
import { LineChartTransform } from "charts/lineCharts/LineChartTransform"
import { ScatterTransform } from "charts/scatterCharts/ScatterTransform"
import { SlopeChartTransform } from "charts/slopeCharts/SlopeChartTransform"
import { ChartView } from "charts/chart/ChartView"
import { Bounds } from "charts/utils/Bounds"
import { IChartTransform } from "charts/chart/ChartTransform"
import { TooltipProps } from "charts/chart/Tooltip"
import { BAKED_GRAPHER_URL, ENV, ADMIN_BASE_URL } from "settings"
import {
    minTimeFromJSON,
    maxTimeFromJSON,
    minTimeToJSON,
    maxTimeToJSON,
    TimeBounds,
    TimeBoundValue
} from "charts/utils/TimeBounds"
import {
    GlobalEntitySelection,
    subscribeGrapherToGlobalEntitySelection
} from "site/globalEntityControl/GlobalEntitySelection"
import { ColorScaleConfigProps } from "charts/color/ColorScaleConfig"
import { countries } from "utils/countries"
import { DataTableTransform } from "charts/dataTable/DataTableTransform"
import { getWindowQueryParams } from "utils/client/url"
import { populationMap } from "owidTable/PopulationMap"
import { GrapherScript } from "charts/core/GrapherScript"
import { DimensionSlot } from "charts/chart/DimensionSlot"
import { canBeExplorable } from "explorer/indicatorExplorer/IndicatorUtils"
import { Analytics } from "./Analytics"

declare const window: any

// That node check is taken from the "detect-node" npm package: https://www.npmjs.com/package/detect-node
const isNode: boolean =
    Object.prototype.toString.call(global.process) === "[object process]"
const isJsdom: boolean =
    typeof navigator === "object" && navigator.userAgent.includes("jsdom")

export class Grapher {
    /** Stores the current state. Can be modified to change the grapher. */
    script = new GrapherScript()

    @observable map: MapConfig = new MapConfig()

    private origScriptRaw: Readonly<GrapherScript>

    // TODO: Pass these 5 in as options, donn't get them as globals
    isDev: Readonly<boolean> = ENV === "development"
    adminBaseUrl: Readonly<string> = ADMIN_BASE_URL
    analytics: Readonly<Analytics> = new Analytics(ENV)
    isEditor: Readonly<boolean> = (window as any).isEditor === true
    bakedGrapherURL: Readonly<string> = BAKED_GRAPHER_URL

    /**
     * The original props as they are stored in the database. Useful for deriving the URL
     * parameters that need to be applied to reach the current state.
     */
    @computed get origScript(): Readonly<GrapherScript> {
        // In the editor, the current state is always the "original" state
        return this.isEditor ? toJS(this.script) : this.origScriptRaw
    }

    private initialScriptRaw: Readonly<GrapherScript>

    /**
     * The props after consuming the initial URL parameters but before any user-triggered
     * changes. Helpful for "resetting" embeds to their initial state.
     */
    @computed get initialScript(): Readonly<GrapherScript> {
        // In the editor, the current state is always the "initial" state
        return this.isEditor ? toJS(this.script) : this.initialScriptRaw
    }

    @observable.ref isEmbed: boolean
    @observable.ref isMediaCard: boolean
    @observable.ref isNode: boolean
    @observable.ref isExporting?: boolean
    @observable.ref tooltip?: TooltipProps
    @observable isPlaying: boolean = false
    @observable.ref isSelectingData: boolean = false

    @computed get isInteractive() {
        return !this.isExporting
    }

    @action.bound toggleMinPopulationFilter() {
        this.script.minPopulationFilter = this.script.minPopulationFilter
            ? undefined
            : this.populationFilterOption
    }

    private populationFilterToggleOption: number = 1e6
    // Make the default filter toggle option reflect what is initially loaded.
    @computed get populationFilterOption() {
        if (this.script.minPopulationFilter)
            this.populationFilterToggleOption = this.script.minPopulationFilter
        return this.populationFilterToggleOption
    }

    // Checks if the data 1) is about countries and 2) has countries with less than the filter option. Used to partly determine whether to show the filter control.
    @computed get hasCountriesSmallerThanFilterOption() {
        return this.table.availableEntities.some(
            entityName =>
                populationMap[entityName] &&
                populationMap[entityName] < this.populationFilterOption
        )
    }

    // at startDrag, we want to show the full axis
    @observable.ref useTimelineDomains = false

    @observable userHasSetTimeline: boolean = false

    @action.bound async downloadData() {
        if (this.script.useV2) return

        if (this.script.externalDataUrl) {
            const json = await fetchJSON(this.script.externalDataUrl)
            this.receiveData(json)
            return
        }

        if (this.script.owidDataset) {
            this.receiveData(this.script.owidDataset)
            return
        }

        if (this.variableIds.length === 0 || this.isNode) {
            // No data to download
            return
        }

        if (window.admin) {
            const json = await window.admin.getJSON(
                `/api/data/variables/${this.dataFileName}`
            )
            this.receiveData(json)
        } else {
            const json = await fetchJSON(this.dataUrl)
            this.receiveData(json)
        }
    }

    @observable.ref table: OwidTable = new OwidTable([])

    // Provide a way to insert an arbitrary element into the embed popup.
    // The "hideControls" property is a param on the explorer, so to maintain
    // modularity between the explorer and chart I am injecting the checkbox this way.
    // In the future if we merge the two we could shift to a cleaner approach.
    @observable.ref embedExplorerCheckbox?: JSX.Element

    @action.bound receiveData(json: OwidVariablesAndEntityKey) {
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
                .map(code => countries.find(country => country.code === code))
                .filter(i => i)
                .map(c => c!.name)
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

    @computed get formatYearFunction(): (
        year: number,
        options?: { format?: string }
    ) => string {
        return this.table.hasDayColumn ? formatDay : formatYear
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
            uniq(flatten(this.filledDimensions.map(d => d.entityNamesUniq)))
        )
    }

    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady(): boolean {
        return this.loadingVarIds.length === 0
    }

    @computed get primaryVariableId() {
        const yDimension = find(this.dimensions, { property: "y" })
        return yDimension ? yDimension.variableId : undefined
    }

    @computed private get loadingVarIds(): number[] {
        return this.dimensions
            .map(dim => dim.variableId)
            .filter(id => !this.table.columnsByOwidVarId.has(id))
    }

    url: GrapherUrl

    @computed get isIframe(): boolean {
        return window.self !== window.top
    }

    @computed get isNativeEmbed(): boolean {
        return this.isEmbed && !this.isIframe && !this.isExporting
    }

    @computed.struct private get variableIds() {
        return uniq(this.dimensions.map(d => d.variableId))
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
            !this.script.hideLogo &&
            (this.script.logo === undefined || this.script.logo === "owid")
        )
    }

    @computed get hasFatalErrors(): boolean {
        const { relatedQuestions } = this.script
        return (
            relatedQuestions?.some(
                question => !!getErrorMessageRelatedQuestionUrl(question)
            ) || false
        )
    }

    disposers: IReactionDisposer[] = []

    @bind dispose() {
        this.disposers.forEach(dispose => dispose())
    }

    constructor(
        props?: GrapherScript,
        options: {
            isEmbed?: boolean
            isMediaCard?: boolean
            queryStr?: string
            globalEntitySelection?: GlobalEntitySelection
        } = {}
    ) {
        this.isEmbed = !!options.isEmbed
        this.isMediaCard = !!options.isMediaCard

        // Todo: there is probably a cleaner way to pass fontSize in.
        const that = this
        const axisContainer: AxisContainerOptions = {
            get fontSize() {
                return that.baseFontSize
            }
        }

        this.yAxisOptions = new AxisOptions(undefined, axisContainer)
        this.xAxisOptions = new AxisOptions(undefined, axisContainer)

        // This attribute is used to decide various client-vs.-server behavior. However, when
        // testing, we want the chart to behave as if it's in the client, even though it's
        // technically being run in a Node environment. To solve this, we override isNode to false
        // if we're in a jsdom environment (where client tests are run). It would probably be best
        // to rename this variable, or better, to break it into one or more behavior flags that
        // could be set by the environment, rather than directly querying the environment itself.
        // -@jasoncrawford 2019-12-04
        this.isNode = isNode && !isJsdom

        this.update(props || { yAxis: { min: 0 } })

        // The original props, as stored in the database
        this.origScriptRaw = toJS(this.script)

        this.disposers.push(
            reaction(() => this.variableIds, this.downloadData, {
                fireImmediately: true
            })
        )

        this.disposers.push(
            reaction(
                () => this.script.minPopulationFilter,
                () => {
                    this.updatePopulationFilter()
                }
            )
        )

        this.url = new GrapherUrl(this, options.queryStr)
        this.url.urlRoot = this.bakedGrapherURL

        // The props after consuming the URL parameters, but before any user interaction
        this.initialScriptRaw = toJS(this.script)

        if (options.globalEntitySelection) {
            this.disposers.push(
                subscribeGrapherToGlobalEntitySelection(
                    this,
                    options.globalEntitySelection
                )
            )
        }

        if (!this.isNode) this.ensureValidConfig()
    }

    updatePopulationFilter() {
        const slug = "pop_filter"
        const minPop = this.script.minPopulationFilter
        if (!minPop) this.table.deleteColumnBySlug(slug)
        else
            this.table.addFilterColumn(slug, (row, index, table) => {
                const name = row.entityName
                const pop = populationMap[name]
                return !pop || pop >= minPop || table!.isSelected(row)
            })
    }

    @action.bound ensureValidConfig() {
        const disposers = [
            autorun(() => {
                if (!this.availableTabs.includes(this.script.tab)) {
                    runInAction(() => (this.script.tab = this.availableTabs[0]))
                }
            }),
            autorun(() => {
                if (!isEqual(this.script.dimensions, this.validDimensions)) {
                    this.script.dimensions = this.validDimensions
                }
            }),
            autorun(() => {
                if (this.script.isExplorable && !canBeExplorable(this.script)) {
                    this.script.isExplorable = false
                }
            })
        ]
        this.disposers.push(...disposers)
    }

    @computed get subtitle() {
        return defaultTo(this.script.subtitle, "")
    }
    @computed get note() {
        return defaultTo(this.script.note, "")
    }
    @computed get internalNotes() {
        return defaultTo(this.script.internalNotes, "")
    }
    @computed get originUrl() {
        return defaultTo(this.script.originUrl, "")
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol(): string {
        let url = this.originUrl
        if (!url.startsWith("http")) url = "https://" + url
        return url
    }

    @computed get isPublished() {
        return defaultTo(this.script.isPublished, false)
    }
    @computed get primaryTab() {
        return this.script.tab
    }
    @computed get overlayTab() {
        return this.script.overlay
    }
    @computed get addCountryMode() {
        return this.script.addCountryMode || "add-country"
    }
    @computed get highlightToggle() {
        return this.script.highlightToggle
    }
    @computed get hasChartTab() {
        return this.script.hasChartTab
    }
    @computed get hasMapTab() {
        return this.script.hasMapTab
    }
    @computed get hideLegend() {
        return this.script.hideLegend
    }
    @computed get baseColorScheme() {
        return this.script.baseColorScheme
    }
    @computed get comparisonLines() {
        return this.script.comparisonLines || []
    }

    @computed get entityType() {
        return defaultTo(this.script.entityType, "country")
    }

    @computed get entityTypePlural() {
        return defaultTo(this.script.entityTypePlural, "countries")
    }

    /** TEMPORARY: Needs to be replaced with declarative filter columns ASAP */
    private chartMinPopulationFilter?: number = undefined
    @action
    revertDataTableSpecificState() {
        /** If the start year was autoselected in the DataTable, revert. */
        if (!this.userHasSetTimeline)
            this.timeDomain = [
                this.initialScript.minTime ?? TimeBoundValue.unboundedLeft,
                this.timeDomain[1]
            ]

        /** Revert the state of minPopulationFilter */
        this.script.minPopulationFilter = this.chartMinPopulationFilter
    }

    @computed get tab() {
        return this.script.overlay ? this.script.overlay : this.script.tab
    }

    /** TEMPORARY: Needs to be replaced with declarative filter columns ASAP */
    set tab(value) {
        if (this.script.tab === "chart")
            this.chartMinPopulationFilter = this.script.minPopulationFilter
        if (this.script.tab === "table" && value !== "table")
            this.revertDataTableSpecificState()

        if (value === "chart" || value === "map" || value === "table") {
            this.script.tab = value
            this.script.overlay = undefined
        } else {
            // table tab cannot be downloaded, so revert to default tab
            if (value === "download" && this.script.tab === "table") {
                this.script.tab = this.origScript.tab
            }
            this.script.overlay = value
        }
    }

    @computed get timeDomain(): TimeBounds {
        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeFromJSON(this.script.minTime),
            maxTimeFromJSON(this.script.maxTime)
        ]
    }

    set timeDomain(value: TimeBounds) {
        this.script.minTime = value[0]
        this.script.maxTime = value[1]
    }

    @observable xAxisOptions: AxisOptions
    @observable yAxisOptions: AxisOptions

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

    @computed get validDimensions(): ChartDimensionSpec[] {
        const { dimensions } = this.script
        const validProperties = map(this.dimensionSlots, "property")
        let validDimensions = filter(dimensions, dim =>
            includes(validProperties, dim.property)
        )

        this.dimensionSlots.forEach(slot => {
            if (!slot.allowMultiple)
                validDimensions = uniqWith(
                    validDimensions,
                    (a: ChartDimensionSpec, b: ChartDimensionSpec) =>
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

        return map(this.dimensions, (dim, i) => {
            return new ChartDimension(
                i,
                dim,
                this.table.columnsByOwidVarId.get(dim.variableId)!
            )
        })
    }

    @computed get primaryDimensions() {
        return this.filledDimensions.filter(dim => dim.property === "y")
    }

    @computed get dimensions() {
        return this.script.dimensions
    }

    @computed private get defaultSlug(): string {
        return slugify(this.title)
    }

    @computed get slug(): string {
        return defaultTo(this.script.slug, this.defaultSlug)
    }

    @computed get availableTabs(): GrapherTabOption[] {
        return filter([
            this.script.hasChartTab && "chart",
            this.script.hasMapTab && "map",
            "table",
            "sources",
            "download"
        ]) as GrapherTabOption[]
    }

    @action.bound update(json: any) {
        for (const key in this.script) {
            if (key in json && key !== "xAxis" && key !== "yAxis") {
                ;(this.script as any)[key] = json[key]
            }
        }

        if (json.isAutoTitle) this.script.title = undefined

        // Auto slug is only preserved for drafts in the editor
        // Once published, slug should stick around (we don't want to create too many redirects)
        if (json.isAutoSlug && this.isEditor && !json.isPublished)
            this.script.slug = undefined

        // JSON doesn't support Infinity, so we use strings instead.
        this.script.minTime = minTimeFromJSON(json.minTime)
        this.script.maxTime = maxTimeFromJSON(json.maxTime)

        if (json.map) {
            this.map = new MapConfig({
                ...json.map,
                targetYear: maxTimeFromJSON(json.map.targetYear)
            })
        }

        this.xAxisOptions.update(json["xAxis"])
        this.yAxisOptions.update(json["yAxis"])

        // Todo: cleanup. This is here because of the toJS stuff
        this.script.xAxis = this.xAxisOptions
        this.script.yAxis = this.yAxisOptions

        extend(this.colorScale, json["colorScale"])

        this.script.dimensions = (json.dimensions || []).map(
            (dimSpec: ChartDimensionInterface) =>
                new ChartDimensionSpec(dimSpec)
        )
    }

    @computed get currentTitle(): string {
        let text = this.title

        if (
            this.primaryTab === "chart" &&
            this.addCountryMode !== "add-country" &&
            this.selectedEntityNames.length === 1 &&
            (!this.script.hideTitleAnnotation || this.canChangeEntity)
        ) {
            const { selectedEntityNames: selectedEntities } = this
            const entityStr = selectedEntities.join(", ")
            if (entityStr.length > 0) {
                text = text + ", " + entityStr
            }
        }

        if (
            !this.script.hideTitleAnnotation &&
            this.isLineChart &&
            this.lineChartTransform.isRelativeMode
        ) {
            text =
                "Change in " +
                (text.charAt(1).match(/[A-Z]/)
                    ? text
                    : text.charAt(0).toLowerCase() + text.slice(1))
        }

        // Causes difficulties with charts like https://ourworldindata.org/grapher/antibiotic-use-in-livestock-in-europe
        /*if (chart.props.tab === "map" && chart.map.props.projection !== "World") {
            const label = labelsByRegion[chart.map.props.projection]
            text = text + ` in ${label}`
        }*/

        if (
            !this.script.hideTitleAnnotation ||
            (this.isLineChart &&
                this.lineChartTransform.isSingleYear &&
                this.lineChartTransform.hasTimeline) ||
            (this.primaryTab === "map" && this.mapTransform.hasTimeline)
        ) {
            const { minYear, maxYear } = this
            const timeFrom = this.formatYearFunction(minYear)
            const timeTo = this.formatYearFunction(maxYear)
            const time =
                timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo

            text = text + ", " + time
        }

        return text.trim()
    }

    @computed get maxYear(): number {
        //if (chart.isScatter && !chart.scatter.failMessage && chart.scatter.xOverrideYear != undefined)
        //    return undefined
        if (this.tab === "table") return this.dataTableTransform.endYear
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
        //if (chart.isScatter && !chart.scatter.failMessage && chart.scatter.xOverrideYear != undefined)
        //    return undefined
        if (this.tab === "table") return this.dataTableTransform.startYear
        else if (this.primaryTab === "map") return this.mapTransform.targetYear
        else if (this.isScatter && !this.scatterTransform.failMessage)
            return this.scatterTransform.startYear
        else if (this.isDiscreteBar && !this.discreteBarTransform.failMessage)
            return this.discreteBarTransform.targetYear
        else if (this.isSlopeChart) return this.slopeChartTransform.startYear
        else return this.lineChartTransform.startYear
    }

    @computed get sourcesLine(): string {
        return this.script.sourceDesc !== undefined
            ? this.script.sourceDesc
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
        each(filledDimensions, dim => {
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
            source => source.source?.name || ""
        )

        // Shorten automatic source names for certain major sources
        sourceNames = sourceNames.map(sourceName => {
            for (const majorSource of [
                "World Bank – WDI",
                "World Bank",
                "ILOSTAT"
            ]) {
                if (sourceName.startsWith(majorSource)) return majorSource
            }
            return sourceName
        })

        return uniq(sourceNames).join(", ")
    }

    @computed get axisDimensions() {
        return this.filledDimensions.filter(
            dim => dim.property === "y" || dim.property === "x"
        )
    }

    @computed private get defaultTitle(): string {
        const { primaryDimensions } = this
        if (this.isScatter)
            return this.axisDimensions.map(d => d.displayName).join(" vs. ")
        else if (
            primaryDimensions.length > 1 &&
            uniq(map(primaryDimensions, d => d.column.datasetName)).length === 1
        )
            return primaryDimensions[0].column.datasetName!
        else if (primaryDimensions.length === 2)
            return primaryDimensions.map(d => d.displayName).join(" and ")
        else return primaryDimensions.map(d => d.displayName).join(", ")
    }

    @computed get title(): string {
        return this.script.title !== undefined
            ? this.script.title
            : this.defaultTitle
    }

    @computed.struct get json(): Readonly<any> {
        const json: any = toJS(this.script)

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!this.script.title) {
            json.title = this.title
            json.isAutoTitle = true
        }
        if (!this.script.slug) {
            json.slug = this.slug
            json.isAutoSlug = true
        }

        if (json.xAxis && json.xAxis.containerOptions)
            delete json.xAxis.containerOptions

        if (json.yAxis && json.yAxis.containerOptions)
            delete json.yAxis.containerOptions

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        json.overlay = undefined

        json.data = {
            availableEntities: this.availableEntityNames
        }

        // JSON doesn't support Infinity, so we use strings instead.
        json.minTime = minTimeToJSON(this.script.minTime)
        json.maxTime = maxTimeToJSON(this.script.maxTime)

        if (this.map) {
            json.map.targetYear = maxTimeToJSON(this.map.targetYear)
        }

        return json
    }

    @computed get isLineChart() {
        return this.script.type === ChartType.LineChart
    }
    @computed get isScatter() {
        return this.script.type === ChartType.ScatterPlot
    }
    @computed get isTimeScatter() {
        return this.script.type === ChartType.TimeScatter
    }
    @computed get isStackedArea() {
        return this.script.type === ChartType.StackedArea
    }
    @computed get isSlopeChart() {
        return this.script.type === ChartType.SlopeChart
    }
    @computed get isDiscreteBar() {
        return this.script.type === ChartType.DiscreteBar
    }
    @computed get isStackedBar() {
        return this.script.type === ChartType.StackedBar
    }

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

    @computed get isValidConfig() {
        return this.activeTransform.isValidConfig
    }

    @computed get selectableEntityDimensionKeys() {
        return this.activeTransform.selectableEntityDimensionKeys.map(key =>
            this.lookupKey(key)
        )
    }

    @observable colorScale: ColorScaleConfigProps = new ColorScaleConfigProps()

    @computed get activeColorScale() {
        return this.activeTransform.colorScale
    }

    @computed get activeTransform(): IChartTransform {
        if (this.tab === "table") return this.dataTableTransform
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

    @computed get staticSVG(): string {
        const svg = ReactDOMServer.renderToStaticMarkup(
            <ChartView chart={this} isExport={true} bounds={this.idealBounds} />
        )

        return svg
    }

    @computed get cacheTag(): string {
        return this.script.version.toString()
    }

    @computed get isExplorable(): boolean {
        return this.script.isExplorable
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
        return this.script.selectedData.length > 0
    }

    // todo: remove
    @computed private get selectionData(): Array<{
        entityDimensionKey: EntityDimensionKey
        color?: Color
    }> {
        const primaryDimensions = this.primaryDimensions
        const entityIdToNameMap = this.table.entityIdToNameMap
        let validSelections = this.script.selectedData.filter(sel => {
            // Must be a dimension that's on the chart
            const dimension = primaryDimensions[sel.index]
            if (!dimension) return false

            // Entity must be within that dimension
            const entityName = entityIdToNameMap.get(sel.entityId)
            if (!entityName || !includes(dimension.entityNamesUniq, entityName))
                return false

            // "change entity" charts can only have one entity selected
            if (
                this.addCountryMode === "change-country" &&
                sel.entityId !==
                    lastOfNonEmptyArray(this.script.selectedData).entityId
            )
                return false

            return true
        })

        validSelections = uniqWith(
            validSelections,
            (a: any, b: any) => a.entityId === b.entityId && a.index === b.index
        )

        return map(validSelections, sel => {
            return {
                entityDimensionKey: this.makeEntityDimensionKey(
                    entityIdToNameMap.get(sel.entityId)!,
                    sel.index
                ),
                color: sel.color
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
        this.selectionData.forEach(d => {
            if (d.color) keyColors[d.entityDimensionKey] = d.color
        })
        return keyColors
    }

    // todo: remove
    setKeyColor(key: EntityDimensionKey, color: Color | undefined) {
        const meta = this.lookupKey(key)
        const selectedData = cloneDeep(this.script.selectedData)
        selectedData.forEach(d => {
            if (d.entityId === meta.entityId && d.index === meta.index) {
                d.color = color
            }
        })
        this.script.selectedData = selectedData
    }

    // todo: remove
    @computed get selectedEntityNames(): EntityName[] {
        return uniq(
            this.selectedKeys.map(key => this.lookupKey(key).entityName)
        )
    }

    // todo: remove
    @computed get availableEntityNames(): EntityName[] {
        const entitiesForDimensions = this.axisDimensions.map(dim => {
            return this.availableKeys
                .map(key => this.lookupKey(key))
                .filter(d => d.dimension.variableId === dim.variableId)
                .map(d => d.entityName)
        })

        return union(...entitiesForDimensions)
    }

    // todo: remove
    @action.bound setSingleSelectedEntity(entityId: EntityId) {
        const selectedData = cloneDeep(this.script.selectedData)
        selectedData.forEach(d => (d.entityId = entityId))
        this.script.selectedData = selectedData
    }

    // todo: remove
    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const matchedEntities = new Map<string, boolean>()
        entityCodes.forEach(code => matchedEntities.set(code, false))
        if (this.canChangeEntity) {
            this.availableEntityNames.forEach(entityName => {
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
            this.selectedKeys = this.availableKeys.filter(key => {
                const meta = this.lookupKey(key)
                const entityName = meta.entityName
                const entityCode = this.table.entityNameToCodeMap.get(
                    entityName
                )
                return [meta.shortCode, entityCode, entityName]
                    .map(key => {
                        if (!matchedEntities.has(key!)) return false
                        matchedEntities.set(key!, true)
                        return true
                    })
                    .some(item => item)
            })
        }
        return matchedEntities
    }

    // todo: remove
    @action.bound resetSelectedEntities() {
        this.script.selectedData = this.initialScript.selectedData
    }

    // todo: remove
    @computed get selectedEntityCodes(): EntityCode[] {
        return uniq(this.selectedKeys.map(k => this.lookupKey(k).shortCode))
    }

    // todo: remove
    deselect(entityDimensionKey: EntityDimensionKey) {
        this.selectedKeys = this.selectedKeys.filter(
            e => e !== entityDimensionKey
        )
    }

    // todo: remove
    @computed get selectedKeys(): EntityDimensionKey[] {
        return this.selectionData.map(d => d.entityDimensionKey)
    }

    // remove
    // Map keys back to their components for storage
    set selectedKeys(keys: EntityDimensionKey[]) {
        if (!this.isReady) return

        const selection = map(keys, key => {
            const { entityName: entity, index } = this.lookupKey(key)
            return {
                entityId: this.table.entityNameToIdMap.get(entity)!,
                index: index,
                color: this.keyColors[key]
            }
        })
        this.script.selectedData = selection
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
            dimension.entityNamesUniq.forEach(entityName => {
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
                            : entityCode || entityName
                })
            })
        })

        return keyData
    }

    // NB: The timeline scatterplot in relative mode calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
        return this.script.stackMode === "relative"
    }

    @action.bound toggleRelativeMode() {
        this.script.stackMode = !this.isRelativeMode ? "relative" : "absolute"
    }

    @computed get canToggleRelativeMode(): boolean {
        return !this.script.hideRelativeToggle
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
        if (includes(this.selectedKeys, key)) {
            this.selectedKeys = this.selectedKeys.filter(k => k !== key)
        } else {
            this.selectedKeys = this.selectedKeys.concat([key])
        }
    }
}
