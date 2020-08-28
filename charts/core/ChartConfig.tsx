import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import {
    configure,
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
import { ComparisonLineConfig } from "charts/scatterCharts/ComparisonLine"
import { AxisConfig, AxisConfigProps } from "charts/axis/AxisSpec"
import {
    ChartType,
    ChartTypeName,
    ChartTabOption,
    Color,
    TickFormattingOptions,
    StackMode
} from "charts/core/ChartConstants"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import { OwidTable } from "owidTable/OwidTable"
import {
    ChartDimension,
    dimensionProperty,
    ChartDimensionSpec,
    ChartDimensionInterface
} from "./ChartDimension"
import { MapConfig } from "charts/mapCharts/MapConfig"
import { MapTransform } from "charts/mapCharts/MapTransform"
import { ChartUrl, EntityUrlBuilder } from "./ChartUrl"
import { StackedBarTransform } from "charts/barCharts/StackedBarTransform"
import { DiscreteBarTransform } from "charts/barCharts/DiscreteBarTransform"
import { StackedAreaTransform } from "charts/areaCharts/StackedAreaTransform"
import { LineChartTransform } from "charts/lineCharts/LineChartTransform"
import { ScatterTransform } from "charts/scatterCharts/ScatterTransform"
import { SlopeChartTransform } from "charts/slopeCharts/SlopeChartTransform"
import { ChartView } from "./ChartView"
import { Bounds } from "charts/utils/Bounds"
import { IChartTransform } from "./ChartTransform"
import { TooltipProps } from "charts/core/Tooltip"
import { LogoOption } from "charts/core/Logos"
import { canBeExplorable } from "utils/charts"
import { BAKED_GRAPHER_URL, ENV } from "settings"
import {
    minTimeFromJSON,
    maxTimeFromJSON,
    minTimeToJSON,
    maxTimeToJSON,
    TimeBound,
    Time,
    TimeBounds,
    TimeBoundValue
} from "charts/utils/TimeBounds"
import {
    GlobalEntitySelection,
    subscribeChartToGlobalEntitySelection
} from "site/client/global-entity/GlobalEntitySelection"
import { ColorScaleConfigProps } from "charts/color/ColorScaleConfig"
import { countries } from "utils/countries"
import { DataTableTransform } from "charts/dataTable/DataTableTransform"
import { getWindowQueryParams } from "utils/client/url"
import { populationMap } from "owidTable/PopulationMap"
import { OwidSource } from "owidTable/OwidSource"
import { EntityDimensionKey } from "charts/core/ChartConstants"
import { entityName, entityId, entityCode } from "owidTable/OwidTable"

export interface SourceWithDimension {
    source: OwidSource
    dimension: ChartDimension
}

export interface EntityDimensionInfo {
    entityName: entityName
    entityId: entityId
    dimension: ChartDimension
    index: number
    entityDimensionKey: EntityDimensionKey
    fullLabel: string
    label: string
    shortCode: string
}

declare const App: any
declare const window: any

const IS_DEV = ENV === "development"
const ENFORCE_ACTIONS = false
if (IS_DEV && ENFORCE_ACTIONS) configure({ enforceActions: "observed" })

// That node check is taken from the "detect-node" npm package: https://www.npmjs.com/package/detect-node
const isNode: boolean =
    Object.prototype.toString.call(global.process) === "[object process]"
const isJsdom: boolean =
    typeof navigator === "object" && navigator.userAgent.includes("jsdom")

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface RelatedQuestionsConfig {
    text: string
    url: string
}

interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: Color
}

// When a user hovers over a connected series line in a ScatterPlot we show
// a label for each point. By default that value will be from the "year" column
// but by changing this option the column used for the x or y axis could be used instead.
export declare type ScatterPointLabelStrategy = "year" | "x" | "y"

export class DimensionSlot {
    chart: ChartConfig
    property: dimensionProperty
    constructor(chart: ChartConfig, property: dimensionProperty) {
        this.chart = chart
        this.property = property
    }

    @computed get name(): string {
        const names = {
            y: this.chart.isDiscreteBar ? "X axis" : "Y axis",
            x: "X axis",
            size: "Size",
            color: "Color",
            filter: "Filter"
        }

        return (names as any)[this.property] || ""
    }

    @computed get allowMultiple(): boolean {
        return (
            this.property === "y" &&
            !(
                this.chart.isScatter ||
                this.chart.isTimeScatter ||
                this.chart.isSlopeChart
            )
        )
    }

    @computed get isOptional(): boolean {
        return this.allowMultiple
    }

    @computed get dimensions(): ChartDimensionSpec[] {
        return this.chart.dimensions.filter(d => d.property === this.property)
    }

    set dimensions(dims: ChartDimensionSpec[]) {
        let newDimensions: ChartDimensionSpec[] = []
        this.chart.dimensionSlots.forEach(slot => {
            if (slot.property === this.property)
                newDimensions = newDimensions.concat(dims)
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.chart.props.dimensions = newDimensions
    }

    @computed get dimensionsWithData(): ChartDimension[] {
        return this.chart.filledDimensions.filter(
            d => d.property === this.property
        )
    }

    createDimension(variableId: number) {
        return new ChartDimensionSpec({ property: this.property, variableId })
    }
}

// This configuration represents the entire persistent state of a grapher chart
// Ideally, this is also all of the interaction state: when a chart is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export class ChartConfigProps {
    constructor(initial?: Partial<ChartConfigProps>) {
        if (initial) {
            for (const key in this) {
                if (key in initial) {
                    ;(this as any)[key] = (initial as any)[key]
                }
            }
        }
    }

    @observable.ref type: ChartTypeName = "LineChart"
    @observable.ref isExplorable: boolean = false

    @observable.ref id?: number = undefined
    @observable.ref createdAt?: Date = undefined
    @observable.ref updatedAt?: Date = undefined
    @observable.ref lastEditedByUserId?: number = undefined
    @observable.ref version: number = 1

    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle?: string = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = undefined
    @observable.ref hideTitleAnnotation?: true = undefined

    @observable.ref xAxis: AxisConfigProps = new AxisConfigProps()
    @observable.ref yAxis: AxisConfigProps = new AxisConfigProps()

    // TODO: These 2 are currently in development. Do not save to DB.
    @observable.ref externalDataUrl?: string = undefined
    @observable.ref owidDataset?: OwidVariablesAndEntityKey = undefined

    // Todo: remove once we migrate to all tables
    useV2?: boolean = false

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined

    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined

    @observable.ref dimensions: ChartDimensionSpec[] = []
    @observable.ref addCountryMode?:
        | "add-country"
        | "change-country"
        | "disabled" = undefined

    @observable comparisonLines?: ComparisonLineConfig[] = undefined
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: StackMode = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle?: boolean = true
    @observable.ref entityType?: string = undefined
    @observable.ref entityTypePlural?: string = undefined
    @observable.ref hideTimeline?: true = undefined
    @observable.ref zoomToSelection?: true = undefined
    @observable.ref minPopulationFilter?: number = undefined

    // Always show year in labels for bar charts
    @observable.ref showYearLabels?: boolean = undefined

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = "chart"
    @observable.ref overlay?: ChartTabOption = undefined

    @observable relatedQuestions?: RelatedQuestionsConfig[]
    @observable.ref internalNotes?: string = undefined
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined

    @observable.ref baseColorScheme?: string = undefined
    @observable.ref invertColorScheme?: true = undefined

    // SCATTERPLOT-SPECIFIC OPTIONS

    @observable colorScale: ColorScaleConfigProps = new ColorScaleConfigProps()

    @observable.ref hideLinesOutsideTolerance?: true = undefined

    // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable hideConnectedScatterLines?: boolean = undefined
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: true = undefined
    @observable.ref matchingEntitiesOnly?: true = undefined
    @observable excludedEntities?: number[] = undefined

    @observable map: MapConfig = new MapConfig()

    data?: { availableEntities: string[] } = undefined
}

// TODO: this really represents more than just the configuration state and should be split
// into multiple components. It's sort of the top-level chart state.
export class ChartConfig {
    /** Stores the current chart state. Can be modified to change the chart. */
    props: ChartConfigProps = new ChartConfigProps()

    private origPropsRaw: Readonly<ChartConfigProps>

    /**
     * The original chart props as they are stored in the database. Useful for deriving the URL
     * parameters that need to be applied to reach the current state.
     */
    @computed get origProps(): Readonly<ChartConfigProps> {
        if (typeof App !== "undefined" && App.isEditor) {
            // In the editor, the current chart state is always the "original" state
            return toJS(this.props)
        } else {
            return this.origPropsRaw
        }
    }

    private initialPropsRaw: Readonly<ChartConfigProps>

    /**
     * The chart props after consuming the initial URL parameters but before any user-triggered
     * changes. Helpful for "resetting" embeds to their initial state.
     */
    @computed get initialProps(): Readonly<ChartConfigProps> {
        if (typeof App !== "undefined" && App.isEditor) {
            // In the editor, the current chart state is always the "initial" state
            return toJS(this.props)
        } else {
            return this.initialPropsRaw
        }
    }

    @observable.ref isEmbed: boolean
    @observable.ref isMediaCard: boolean
    @observable.ref isNode: boolean
    @observable.ref isExporting?: boolean
    @observable.ref tooltip?: TooltipProps
    @observable isPlaying: boolean = false
    @observable.ref isSelectingData: boolean = false

    @action.bound toggleMinPopulationFilter() {
        this.props.minPopulationFilter = this.props.minPopulationFilter
            ? undefined
            : this.populationFilterOption
    }

    private populationFilterToggleOption: number = 1e6
    // Make the default filter toggle option reflect what is initially loaded.
    @computed get populationFilterOption() {
        if (this.props.minPopulationFilter)
            this.populationFilterToggleOption = this.props.minPopulationFilter
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
        if (this.props.useV2) return

        if (this.props.externalDataUrl) {
            const json = await fetchJSON(this.props.externalDataUrl)
            this.receiveData(json)
            return
        }

        if (this.props.owidDataset) {
            this.receiveData(this.props.owidDataset)
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

    @observable.ref setBaseFontSize: number = 16
    @computed get baseFontSize(): number {
        if (this.isMediaCard) return 24
        else if (this.isExporting) return 18
        else return this.setBaseFontSize
    }

    set baseFontSize(val: number) {
        this.setBaseFontSize = val
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

    // Chart is ready to go iff we have retrieved data for every variable associated with the chart
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

    url: ChartUrl

    @computed get isIframe(): boolean {
        return window.self !== window.top
    }

    private get isEditor(): boolean {
        return typeof App !== "undefined" && App.isEditor
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
        return `${BAKED_GRAPHER_URL}/data/variables/${this.dataFileName}`
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
            !this.props.hideLogo &&
            (this.props.logo === undefined || this.props.logo === "owid")
        )
    }

    @computed get hasFatalErrors(): boolean {
        const { relatedQuestions } = this.props
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
        props?: ChartConfigProps,
        options: {
            isEmbed?: boolean
            isMediaCard?: boolean
            queryStr?: string
            globalEntitySelection?: GlobalEntitySelection
        } = {}
    ) {
        this.isEmbed = !!options.isEmbed
        this.isMediaCard = !!options.isMediaCard

        // This attribute is used to decide various client-vs.-server behavior. However, when
        // testing, we want the chart to behave as if it's in the client, even though it's
        // technically being run in a Node environment. To solve this, we override isNode to false
        // if we're in a jsdom environment (where client tests are run). It would probably be best
        // to rename this variable, or better, to break it into one or more behavior flags that
        // could be set by the environment, rather than directly querying the environment itself.
        // -@jasoncrawford 2019-12-04
        this.isNode = isNode && !isJsdom

        this.update(props || { yAxis: { min: 0 } })

        // The original chart props, as stored in the database
        this.origPropsRaw = toJS(this.props)

        this.disposers.push(
            reaction(() => this.variableIds, this.downloadData, {
                fireImmediately: true
            })
        )

        this.disposers.push(
            reaction(
                () => this.props.minPopulationFilter,
                () => {
                    this.updatePopulationFilter()
                }
            )
        )

        this.url = new ChartUrl(this, options.queryStr)

        // The chart props after consuming the URL parameters, but before any user interaction
        this.initialPropsRaw = toJS(this.props)

        if (options.globalEntitySelection) {
            this.disposers.push(
                subscribeChartToGlobalEntitySelection(
                    this,
                    options.globalEntitySelection
                )
            )
        }

        if (!this.isNode) this.ensureValidConfig()
    }

    updatePopulationFilter() {
        const slug = "pop_filter"
        const minPop = this.props.minPopulationFilter
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
                if (!this.availableTabs.includes(this.props.tab)) {
                    runInAction(() => (this.props.tab = this.availableTabs[0]))
                }
            }),
            autorun(() => {
                if (this.props.hasMapTab && !this.props.map) {
                    runInAction(() => (this.props.map = new MapConfig()))
                }
            }),
            autorun(() => {
                if (!isEqual(this.props.dimensions, this.validDimensions)) {
                    this.props.dimensions = this.validDimensions
                }
            }),
            autorun(() => {
                if (this.props.isExplorable && !canBeExplorable(this.props)) {
                    this.props.isExplorable = false
                }
            })
        ]
        this.disposers.push(...disposers)
    }

    @computed get subtitle() {
        return defaultTo(this.props.subtitle, "")
    }
    @computed get note() {
        return defaultTo(this.props.note, "")
    }
    @computed get internalNotes() {
        return defaultTo(this.props.internalNotes, "")
    }
    @computed get originUrl() {
        return defaultTo(this.props.originUrl, "")
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol(): string {
        let url = this.originUrl
        if (!url.startsWith("http")) url = "https://" + url
        return url
    }

    @computed get isPublished() {
        return defaultTo(this.props.isPublished, false)
    }
    @computed get primaryTab() {
        return this.props.tab
    }
    @computed get overlayTab() {
        return this.props.overlay
    }
    @computed get addCountryMode() {
        return this.props.addCountryMode || "add-country"
    }
    @computed get highlightToggle() {
        return this.props.highlightToggle
    }
    @computed get hasChartTab() {
        return this.props.hasChartTab
    }
    @computed get hasMapTab() {
        return this.props.hasMapTab
    }
    @computed get hideLegend() {
        return this.props.hideLegend
    }
    @computed get baseColorScheme() {
        return this.props.baseColorScheme
    }
    @computed get comparisonLines() {
        return this.props.comparisonLines || []
    }

    @computed get entityType() {
        return defaultTo(this.props.entityType, "country")
    }

    @computed get entityTypePlural() {
        return defaultTo(this.props.entityTypePlural, "countries")
    }

    /** TEMPORARY: Needs to be replaced with declarative filter columns ASAP */
    private chartMinPopulationFilter?: number = undefined
    @action
    revertDataTableSpecificState() {
        /** If the start year was autoselected in the DataTable, revert. */
        if (!this.userHasSetTimeline)
            this.timeDomain = [
                this.initialProps.minTime ?? TimeBoundValue.unboundedLeft,
                this.timeDomain[1]
            ]

        /** Revert the state of minPopulationFilter */
        this.props.minPopulationFilter = this.chartMinPopulationFilter
    }

    @computed get tab() {
        return this.props.overlay ? this.props.overlay : this.props.tab
    }

    /** TEMPORARY: Needs to be replaced with declarative filter columns ASAP */
    set tab(value) {
        if (this.props.tab === "chart")
            this.chartMinPopulationFilter = this.props.minPopulationFilter
        if (this.props.tab === "table" && value !== "table")
            this.revertDataTableSpecificState()

        if (value === "chart" || value === "map" || value === "table") {
            this.props.tab = value
            this.props.overlay = undefined
        } else {
            // table tab cannot be downloaded, so revert to default tab
            if (value === "download" && this.props.tab === "table") {
                this.props.tab = this.origProps.tab
            }
            this.props.overlay = value
        }
    }

    @computed get timeDomain(): TimeBounds {
        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeFromJSON(this.props.minTime),
            maxTimeFromJSON(this.props.maxTime)
        ]
    }

    set timeDomain(value: TimeBounds) {
        this.props.minTime = value[0]
        this.props.maxTime = value[1]
    }

    @computed get xAxis() {
        return new AxisConfig(this.props.xAxis)
    }

    @computed get yAxis() {
        return new AxisConfig(this.props.yAxis)
    }

    @computed get xAxisProps() {
        return this.xAxis.props
    }

    @computed get yAxisProps() {
        return this.yAxis.props
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

    @computed get validDimensions(): ChartDimensionSpec[] {
        const { dimensions } = this.props
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
        return this.props.dimensions
    }

    @computed private get defaultSlug(): string {
        return slugify(this.title)
    }

    @computed get slug(): string {
        return defaultTo(this.props.slug, this.defaultSlug)
    }

    @computed get availableTabs(): ChartTabOption[] {
        return filter([
            this.props.hasChartTab && "chart",
            this.props.hasMapTab && "map",
            "table",
            "sources",
            "download"
        ]) as ChartTabOption[]
    }

    @action.bound update(json: any) {
        for (const key in this.props) {
            if (key in json && key !== "xAxis" && key !== "yAxis") {
                ;(this.props as any)[key] = json[key]
            }
        }

        if (json.isAutoTitle) this.props.title = undefined

        // Auto slug is only preserved for drafts in the editor
        // Once published, slug should stick around (we don't want to create too many redirects)
        if (json.isAutoSlug && App.isEditor && !json.isPublished)
            this.props.slug = undefined

        // JSON doesn't support Infinity, so we use strings instead.
        this.props.minTime = minTimeFromJSON(json.minTime)
        this.props.maxTime = maxTimeFromJSON(json.maxTime)

        if (json.map) {
            this.props.map = new MapConfig({
                ...json.map,
                targetYear: maxTimeFromJSON(json.map.targetYear)
            })
        }

        extend(this.props.xAxis, json["xAxis"])
        extend(this.props.yAxis, json["yAxis"])

        this.props.dimensions = (json.dimensions || []).map(
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
            (!this.props.hideTitleAnnotation || this.canChangeEntity)
        ) {
            const { selectedEntityNames: selectedEntities } = this
            const entityStr = selectedEntities.join(", ")
            if (entityStr.length > 0) {
                text = text + ", " + entityStr
            }
        }

        if (
            !this.props.hideTitleAnnotation &&
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
            !this.props.hideTitleAnnotation ||
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
        return this.props.sourceDesc !== undefined
            ? this.props.sourceDesc
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
        return this.props.title !== undefined
            ? this.props.title
            : this.defaultTitle
    }

    @computed.struct get json(): Readonly<any> {
        const json: any = toJS(this.props)

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!this.props.title) {
            json.title = this.title
            json.isAutoTitle = true
        }
        if (!this.props.slug) {
            json.slug = this.slug
            json.isAutoSlug = true
        }

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        json.overlay = undefined

        json.data = {
            availableEntities: this.availableEntityNames
        }

        // JSON doesn't support Infinity, so we use strings instead.
        json.minTime = minTimeToJSON(this.props.minTime)
        json.maxTime = maxTimeToJSON(this.props.maxTime)

        if (this.props.map) {
            json.map.targetYear = maxTimeToJSON(this.props.map.targetYear)
        }

        return json
    }

    @computed get isLineChart() {
        return this.props.type === ChartType.LineChart
    }
    @computed get isScatter() {
        return this.props.type === ChartType.ScatterPlot
    }
    @computed get isTimeScatter() {
        return this.props.type === ChartType.TimeScatter
    }
    @computed get isStackedArea() {
        return this.props.type === ChartType.StackedArea
    }
    @computed get isSlopeChart() {
        return this.props.type === ChartType.SlopeChart
    }
    @computed get isDiscreteBar() {
        return this.props.type === ChartType.DiscreteBar
    }
    @computed get isStackedBar() {
        return this.props.type === ChartType.StackedBar
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

    @computed get activeTransform(): IChartTransform {
        if (this.isLineChart) return this.lineChartTransform
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
        return this.props.version.toString()
    }

    @computed get isExplorable(): boolean {
        return this.props.isExplorable
    }

    // todo: remove
    // Make a unique string key for an entity on a variable
    makeEntityDimensionKey(
        entityName: entityName,
        dimensionIndex: number
    ): EntityDimensionKey {
        return `${entityName}_${dimensionIndex}`
    }

    // todo: remove
    @computed get hasSelection() {
        return this.props.selectedData.length > 0
    }

    // todo: remove
    @computed private get selectionData(): Array<{
        entityDimensionKey: EntityDimensionKey
        color?: Color
    }> {
        const chart = this
        const primaryDimensions = chart.primaryDimensions
        const entityIdToNameMap = chart.table.entityIdToNameMap
        let validSelections = chart.props.selectedData.filter(sel => {
            // Must be a dimension that's on the chart
            const dimension = primaryDimensions[sel.index]
            if (!dimension) return false

            // Entity must be within that dimension
            const entityName = entityIdToNameMap.get(sel.entityId)
            if (!entityName || !includes(dimension.entityNamesUniq, entityName))
                return false

            // "change entity" charts can only have one entity selected
            if (
                chart.addCountryMode === "change-country" &&
                sel.entityId !==
                    lastOfNonEmptyArray(chart.props.selectedData).entityId
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
        const selectedData = cloneDeep(this.props.selectedData)
        selectedData.forEach(d => {
            if (d.entityId === meta.entityId && d.index === meta.index) {
                d.color = color
            }
        })
        this.props.selectedData = selectedData
    }

    // todo: remove
    @computed get selectedEntityNames(): entityName[] {
        return uniq(
            this.selectedKeys.map(key => this.lookupKey(key).entityName)
        )
    }

    // todo: remove
    @computed get availableEntityNames(): entityName[] {
        const entitiesForDimensions = this.axisDimensions.map(dim => {
            return this.availableKeys
                .map(key => this.lookupKey(key))
                .filter(d => d.dimension.variableId === dim.variableId)
                .map(d => d.entityName)
        })

        return union(...entitiesForDimensions)
    }

    // todo: remove
    @action.bound setSingleSelectedEntity(entityId: entityId) {
        const selectedData = cloneDeep(this.props.selectedData)
        selectedData.forEach(d => (d.entityId = entityId))
        this.props.selectedData = selectedData
    }

    // todo: remove
    @action.bound setSelectedEntitiesByCode(entityCodes: entityCode[]) {
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
        this.props.selectedData = this.initialProps.selectedData
    }

    // todo: remove
    @computed get selectedEntityCodes(): entityCode[] {
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
        const chart = this
        if (!chart.isReady) return

        const selection = map(keys, key => {
            const { entityName: entity, index } = this.lookupKey(key)
            return {
                entityId: this.table.entityNameToIdMap.get(entity)!,
                index: index,
                color: this.keyColors[key]
            }
        })
        chart.props.selectedData = selection
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
        const chart = this
        const { isSingleEntity, isSingleVariable } = chart
        const primaryDimensions = chart.primaryDimensions

        const keyData = new Map<EntityDimensionKey, EntityDimensionInfo>()
        primaryDimensions.forEach((dimension, dimensionIndex) => {
            dimension.entityNamesUniq.forEach(entityName => {
                const entityCode = chart.table.entityNameToCodeMap.get(
                    entityName
                )
                const entityId = chart.table.entityNameToIdMap.get(entityName)!
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
                        chart.addCountryMode !== "change-country"
                            ? `${entityCode || entityName}-${dimension.index}`
                            : entityCode || entityName
                })
            })
        })

        return keyData
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
        entityName,
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
