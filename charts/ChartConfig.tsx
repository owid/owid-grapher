import { extend, map, filter, includes, uniqWith, isEqual, first } from "./Util"
import { observable, computed, action, autorun, toJS, runInAction } from "mobx"
import { ComparisonLineConfig } from "./ComparisonLine"
import { AxisConfig, AxisConfigProps } from "./AxisConfig"
import { ChartType, ChartTypeType } from "./ChartType"
import { ChartTabOption } from "./ChartTabOption"
import { defaultTo, formatDay, formatYear } from "./Util"
import { VariableData, DataForChart } from "./VariableData"
import { ChartData } from "./ChartData"
import { DimensionWithData } from "./DimensionWithData"
import { MapConfig, MapConfigProps } from "./MapConfig"
import { ChartUrl } from "./ChartUrl"
import { StackedBarTransform } from "./StackedBarTransform"
import { DiscreteBarTransform } from "./DiscreteBarTransform"
import { StackedAreaTransform } from "./StackedAreaTransform"
import { LineChartTransform } from "./LineChartTransform"
import { ScatterTransform } from "./ScatterTransform"
import { SlopeChartTransform } from "./SlopeChartTransform"
import { Color } from "./Color"
import { ChartView } from "./ChartView"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { Bounds } from "./Bounds"
import { IChartTransform } from "./IChartTransform"
import { ChartDimension } from "./ChartDimension"
import { TooltipProps } from "./Tooltip"
import { LogoOption } from "./Logos"
import { canBeExplorable } from "utils/charts"

declare const App: any
declare const window: any
const isNode: boolean = require("detect-node")
const isJsdom: boolean =
    typeof navigator === "object" && navigator.userAgent.includes("jsdom")

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface EntitySelection {
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
    property: string
    constructor(chart: ChartConfig, property: string) {
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
        return this.allowMultiple || this.property === "filter"
    }

    @computed get dimensions(): ChartDimension[] {
        return this.chart.dimensions.filter(d => d.property === this.property)
    }

    set dimensions(dims: ChartDimension[]) {
        let newDimensions: ChartDimension[] = []
        this.chart.dimensionSlots.forEach(slot => {
            if (slot.property === this.property)
                newDimensions = newDimensions.concat(dims)
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.chart.props.dimensions = newDimensions
    }

    @computed get dimensionsWithData(): DimensionWithData[] {
        return this.chart.data.filledDimensions.filter(
            d => d.property === this.property
        )
    }

    createDimension(variableId: number) {
        return new ChartDimension({ property: this.property, variableId })
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

    @observable.ref type: ChartTypeType = "LineChart"
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

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref minTime?: number = undefined
    @observable.ref maxTime?: number = undefined

    @observable.ref timelineMinTime?: number = undefined
    @observable.ref timelineMaxTime?: number = undefined

    @observable.ref dimensions: ChartDimension[] = []
    @observable.ref addCountryMode?:
        | "add-country"
        | "change-country"
        | "disabled" = undefined

    @observable comparisonLines?: ComparisonLineConfig[] = undefined
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: string = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle?: boolean = true
    @observable.ref entityType?: string = undefined
    @observable.ref hideTimeline?: true = undefined

    // Always show year in labels for bar charts
    @observable.ref showYearLabels?: boolean = undefined

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = "chart"
    @observable.ref overlay?: ChartTabOption = undefined

    @observable.ref internalNotes?: string = undefined
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined

    @observable colorBy?: string = undefined
    @observable customColors?: { [key: string]: Color | undefined } = undefined
    @observable.ref baseColorScheme?: string = undefined
    @observable.ref invertColorScheme?: true = undefined

    // SCATTERPLOT-SPECIFIC OPTIONS

    @observable.ref hideLinesOutsideTolerance?: true = undefined

    // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable hideConnectedScatterLines?: boolean = undefined
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: true = undefined
    @observable.ref matchingEntitiesOnly?: true = undefined
    @observable excludedEntities?: number[] = undefined

    @observable map?: MapConfigProps = undefined

    data?: { availableEntities: string[] } = undefined
}

// TODO: this really represents more than just the configuration state and should be split
// into multiple components. It's sort of the top-level chart state.
export class ChartConfig {
    props: ChartConfigProps = new ChartConfigProps()

    @observable.ref isEmbed: boolean
    @observable.ref isMediaCard: boolean
    @observable.ref isNode: boolean
    @observable.ref isLocalExport?: boolean
    @observable.ref tooltip?: TooltipProps

    // at startDrag, we want to show the full axis
    @observable.ref useTimelineDomains = false

    @observable.ref setBaseFontSize: number = 16
    @computed get baseFontSize(): number {
        if (this.isMediaCard) return 24
        else if (this.isLocalExport) return 18
        else return this.setBaseFontSize
    }

    set baseFontSize(val: number) {
        this.setBaseFontSize = val
    }

    @computed get yearIsDayVar() {
        return first(this.vardata.variables.filter(v => v.display.yearIsDay))
    }

    @computed get formatYearFunction() {
        const yearIsDayVar = this.yearIsDayVar
        return yearIsDayVar
            ? (day: number) => formatDay(day, yearIsDayVar.display.zeroDay)
            : formatYear
    }

    vardata: VariableData
    data: ChartData
    url: ChartUrl

    @computed get isIframe(): boolean {
        return window.self !== window.top
    }

    get isEditor(): boolean {
        return App.isEditor
    }

    @computed get isNativeEmbed(): boolean {
        return this.isEmbed && !this.isIframe && !this.isLocalExport
    }

    @computed get hasOWIDLogo(): boolean {
        return (
            !this.props.hideLogo &&
            (this.props.logo === undefined || this.props.logo === "owid")
        )
    }

    constructor(
        props?: ChartConfigProps,
        options: {
            isEmbed?: boolean
            isMediaCard?: boolean
            queryStr?: string
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
        this.vardata = new VariableData(this)
        this.data = new ChartData(this)
        this.url = new ChartUrl(this, options.queryStr)

        if (!this.isNode) this.ensureValidConfig()
    }

    ensureValidConfig() {
        autorun(() => {
            if (!this.availableTabs.includes(this.props.tab)) {
                runInAction(() => (this.props.tab = this.availableTabs[0]))
            }
        })

        autorun(() => {
            if (this.props.hasMapTab && !this.props.map) {
                runInAction(() => (this.props.map = new MapConfigProps()))
            }
        })

        autorun(() => {
            if (!isEqual(this.props.dimensions, this.validDimensions)) {
                this.props.dimensions = this.validDimensions
            }
        })

        autorun(() => {
            if (this.props.isExplorable && !canBeExplorable(this.props)) {
                this.props.isExplorable = false
            }
        })
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

    @computed get tab() {
        return this.props.overlay ? this.props.overlay : this.props.tab
    }

    set tab(value) {
        if (value === "chart" || value === "map") {
            this.props.tab = value
            this.props.overlay = undefined
        } else {
            this.props.overlay = value
        }
    }

    @computed get timeDomain(): [number | undefined, number | undefined] {
        return [
            defaultTo(this.props.minTime, undefined),
            defaultTo(this.props.maxTime, undefined)
        ]
    }

    set timeDomain(value: [number | undefined, number | undefined]) {
        this.props.minTime = defaultTo(value[0], undefined)
        this.props.maxTime = defaultTo(value[1], undefined)
    }

    @computed get xAxis() {
        return new AxisConfig(this.props.xAxis)
    }

    @computed get yAxis() {
        return new AxisConfig(this.props.yAxis)
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

    @computed get validDimensions(): ChartDimension[] {
        const { dimensions } = this.props
        const validProperties = map(this.dimensionSlots, "property")
        let validDimensions = filter(dimensions, dim =>
            includes(validProperties, dim.property)
        )

        this.dimensionSlots.forEach(slot => {
            if (!slot.allowMultiple)
                validDimensions = uniqWith(
                    validDimensions,
                    (a: ChartDimension, b: ChartDimension) =>
                        a.property === slot.property &&
                        a.property === b.property
                )
        })

        return validDimensions
    }

    @computed get dimensions() {
        return this.props.dimensions
    }

    @computed get availableTabs(): ChartTabOption[] {
        return filter([
            this.props.hasChartTab && "chart",
            this.props.hasMapTab && "map",
            "data",
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

        this.props.map = new MapConfigProps(json.map)
        extend(this.props.xAxis, json["xAxis"])
        extend(this.props.yAxis, json["yAxis"])

        this.props.dimensions = (json.dimensions || []).map(
            (j: any) => new ChartDimension(j)
        )
    }

    @computed.struct get json() {
        const { props } = this

        const json: any = toJS(this.props)

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!this.props.title) {
            json.title = this.data.title
            json.isAutoTitle = true
        }
        if (!this.props.slug) {
            json.slug = this.data.slug
            json.isAutoSlug = true
        }

        json.data = {
            availableEntities: this.data.availableEntities
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

    @computed get lineChart() {
        return new LineChartTransform(this)
    }
    @computed get scatter() {
        return new ScatterTransform(this)
    }
    @computed get stackedArea() {
        return new StackedAreaTransform(this)
    }
    @computed get slopeChart() {
        return new SlopeChartTransform(this)
    }
    @computed get discreteBar() {
        return new DiscreteBarTransform(this)
    }
    @computed get stackedBar() {
        return new StackedBarTransform(this)
    }
    @computed get map() {
        return new MapConfig(this)
    }

    @computed get activeTransform(): IChartTransform {
        if (this.isLineChart) return this.lineChart
        else if (this.isScatter || this.isTimeScatter) return this.scatter
        else if (this.isStackedArea) return this.stackedArea
        else if (this.isSlopeChart) return this.slopeChart
        else if (this.isDiscreteBar) return this.discreteBar
        else if (this.isStackedBar) return this.stackedBar
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

    receiveData(data: DataForChart) {
        this.vardata.receiveData(data)
    }
}
