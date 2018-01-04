import { extend, map, filter, includes, uniqWith, find, isEqual } from "./Util"
import { observable, computed, action, autorun, toJS, runInAction } from 'mobx'
import { ComparisonLineConfig } from './ComparisonLine'
import AxisConfig, { AxisConfigProps } from './AxisConfig'
import ChartType, { ChartTypeType } from './ChartType'
import ChartTabOption from './ChartTabOption'
import { defaultTo } from './Util'
import VariableData from './VariableData'
import ChartData from './ChartData'
import DimensionWithData from './DimensionWithData'
import MapConfig, { MapConfigProps } from './MapConfig'
import URLBinder from "./URLBinder"
import DiscreteBarTransform from './DiscreteBarTransform'
import StackedAreaTransform from './StackedAreaTransform'
import LineChartTransform from "./LineChartTransform"
import ScatterTransform from "./ScatterTransform"
import SlopeChartTransform from "./SlopeChartTransform"
import Color from "./Color"
import ChartView from "./ChartView"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import Bounds from "./Bounds"
import IChartTransform from "./IChartTransform"
import ChartDimension from "./ChartDimension"
import * as md5 from 'md5'

declare const App: any
declare const window: any
const isNode: boolean = require('detect-node')

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface EntitySelection {
    entityId: number,
    index: number, // Which dimension the entity is from
    color?: Color
}

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
        return this.property === "y" && !(this.chart.isScatter || this.chart.isSlopeChart)
    }

    @computed get isOptional(): boolean {
        return this.allowMultiple || this.property === "filter"
    }

    @computed get dimensions(): ChartDimension[] {
        return this.chart.dimensions.filter((d) => d.property === this.property)
    }

    set dimensions(dims: ChartDimension[]) {
        let newDimensions: ChartDimension[] = []
        this.chart.dimensionSlots.forEach((slot) => {
            if (slot.property === this.property)
                newDimensions = newDimensions.concat(dims)
            else
                newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.chart.props.dimensions = newDimensions
    }

    @computed get dimensionsWithData(): DimensionWithData[] {
        return this.chart.data.filledDimensions.filter(d => d.property === this.property)
    }

    createDimension(variableId: number) {
        return new ChartDimension({ property: this.property, variableId })
    }
}

// This configuration represents the entire persistent state of a grapher chart
// Ideally, this is also all of the interaction state: when a chart is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export class ChartConfigProps {
    @observable.ref type: ChartTypeType = "LineChart"

    @observable.ref id?: number = undefined
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

    @observable.ref dimensions: ChartDimension[] = []
    @observable.ref addCountryMode?: "add-country" | "change-country" | "disabled" = undefined

    @observable.ref comparisonLine?: ComparisonLineConfig = undefined
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: string = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref hideRelativeToggle?: true = undefined
    @observable.ref entityType?: string = undefined

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = "chart"
    @observable.ref overlay?: ChartTabOption = undefined

    @observable.ref internalNotes?: string = undefined
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined

    @observable.ref baseColorScheme?: string = undefined
    @observable.ref invertColorScheme?: true = undefined

    // Currently scatterplot-specific options
    @observable.ref hideTimeline?: true = undefined
    @observable.ref hideLinesOutsideTolerance?: true = undefined
    @observable.ref compareEndPointsOnly?: true = undefined
    @observable.ref matchingEntitiesOnly?: true = undefined
    @observable.struct excludedEntities?: number[] = undefined

    @observable map?: MapConfigProps = undefined
    @observable lastEditedAt?: string = undefined
}

// TODO: this really represents more than just the configuration state and should be split
// into multiple components. It's sort of the top-level chart state.
export default class ChartConfig {
    props: ChartConfigProps = new ChartConfigProps()

    @observable.ref logosSVG: string[]
    @observable.ref variableCacheTag: string
    @observable.ref tooltip: React.ReactNode
    @observable.ref isEmbed: boolean
    @observable.ref isMediaCard: boolean
    @observable.ref isNode: boolean
    @observable.ref isLocalExport: boolean
    @observable.ref baseFontSize: number = 16

    vardata: VariableData
    data: ChartData
    url: URLBinder

    @computed get isIframe(): boolean {
        return window.self !== window.top
    }

    @computed get isNativeEmbed(): boolean {
        return this.isEmbed && !this.isIframe && !this.isLocalExport
    }

    constructor(props?: ChartConfigProps, options: { isEmbed?: boolean, isMediaCard?: boolean, queryStr?: string } = {}) {
        this.isEmbed = !!options.isEmbed
        this.isMediaCard = !!options.isMediaCard
        this.isNode = isNode

        this.update(props || new ChartConfigProps())
        this.vardata = new VariableData(this)
        this.data = new ChartData(this)
        this.url = new URLBinder(this, options.queryStr)

        if (this.isMediaCard)
            this.baseFontSize = 24

        window.chart = this
        if (!this.isNode) this.ensureValidConfig()
    }

    ensureValidConfig() {
        autorun(() => {
            if (!includes(this.availableTabs, this.props.tab)) {
                runInAction(() => this.props.tab = this.availableTabs[0])
            }
        })

        autorun(() => {
            if (this.props.hasMapTab && !this.props.map) {
                runInAction(() => this.props.map = new MapConfigProps())
            }
        })

        autorun(() => {
            if (!isEqual(this.props.dimensions, this.validDimensions)) {
                this.props.dimensions = this.validDimensions
            }
        })
    }

    @computed get subtitle() { return defaultTo(this.props.subtitle, "") }
    @computed get note() { return defaultTo(this.props.note, "") }
    @computed get internalNotes() { return defaultTo(this.props.internalNotes, "") }
    @computed get originUrl() { return defaultTo(this.props.originUrl, "") }
    @computed get isPublished() { return defaultTo(this.props.isPublished, false) }
    @computed get primaryTab() { return this.props.tab }
    @computed get overlayTab() { return this.props.overlay }
    @computed get addCountryMode() { return this.props.addCountryMode || "add-country" }
    @computed get comparisonLine() { return this.props.comparisonLine }
    @computed get highlightToggle() { return this.props.highlightToggle }
    @computed get hasChartTab() { return this.props.hasChartTab }
    @computed get hasMapTab() { return this.props.hasMapTab }
    @computed get hideLegend() { return this.props.hideLegend }
    @computed get baseColorScheme() { return this.props.baseColorScheme }

    @computed get entityType() { return defaultTo(this.props.entityType, "country") }

    @computed get tab() { return this.props.overlay ? this.props.overlay : this.props.tab }

    set tab(value) {
        if (value === "chart" || value === "map") {
            this.props.tab = value
            this.props.overlay = undefined
        } else {
            this.props.overlay = value
        }
    }

    @computed get timeDomain(): [number | undefined, number | undefined] {
        return [this.props.minTime || undefined, this.props.maxTime || undefined]
    }

    set timeDomain(value: [number | undefined, number | undefined]) {
        this.props.minTime = value[0] || undefined
        this.props.maxTime = value[1] || undefined
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

        if (this.isScatter)
            return [yAxis, xAxis, size, color]
        else if (this.isSlopeChart)
            return [yAxis, size, color]
        else
            return [yAxis]
    }

    @computed get validDimensions(): ChartDimension[] {
        const { dimensions } = this.props
        const validProperties = map(this.dimensionSlots, "property")
        let validDimensions = filter(dimensions, (dim) => includes(validProperties, dim.property))

        this.dimensionSlots.forEach((slot) => {
            if (!slot.allowMultiple)
                validDimensions = uniqWith(validDimensions, (a: ChartDimension, b: ChartDimension) => a.property === slot.property && a.property === b.property)
        })

        // Give scatterplots and slope charts a default color and size dimension if they don't have one
        if ((this.isScatter || this.isSlopeChart) && !find(dimensions, { property: "color" })) {
            validDimensions = validDimensions.concat(new ChartDimension({ variableId: 123, property: "color" }))
        }

        if ((this.isScatter || this.isSlopeChart) && !find(dimensions, { property: "size" })) {
            validDimensions = validDimensions.concat(new ChartDimension({ variableId: 72, property: "size" }))
        }

        return validDimensions
    }

    @computed get dimensions() {
        return this.props.dimensions
    }

    @computed get availableTabs(): ChartTabOption[] {
        return filter([this.props.hasChartTab && "chart", this.props.hasMapTab && "map", "data", "sources", "download"]) as ChartTabOption[]
    }

    @action.bound update(json: any) {
        for (const key in this.props) {
            if (key in json && key !== "xAxis" && key !== "yAxis") {
                (this.props as any)[key] = json[key]
            }
        }

        if (json.isAutoTitle)
            this.props.title = undefined

        // Auto slug is only preserved for drafts in the editor
        // Once published, slug should stick around (we don't want to create too many redirects)
        if (json.isAutoSlug && App.isEditor && !json.isPublished)
            this.props.slug = undefined

        this.props.map = new MapConfigProps(json.map)
        extend(this.props.xAxis, json["xAxis"])
        extend(this.props.yAxis, json["yAxis"])

        this.props.dimensions = (json.dimensions || []).map((j: any) => new ChartDimension(j))
        this.logosSVG = json["logosSVG"]
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

        return json
    }

    @computed get isLineChart() { return this.props.type === ChartType.LineChart }
    @computed get isScatter() { return this.props.type === ChartType.ScatterPlot }
    @computed get isStackedArea() { return this.props.type === ChartType.StackedArea }
    @computed get isSlopeChart() { return this.props.type === ChartType.SlopeChart }
    @computed get isDiscreteBar() { return this.props.type === ChartType.DiscreteBar }

    @computed get lineChart() { return new LineChartTransform(this) }
    @computed get scatter() { return new ScatterTransform(this) }
    @computed get stackedArea() { return new StackedAreaTransform(this) }
    @computed get slopeChart() { return new SlopeChartTransform(this) }
    @computed get discreteBar() { return new DiscreteBarTransform(this) }
    @computed get map() { return new MapConfig(this) }

    @computed get activeTransform(): IChartTransform {
        if (this.isLineChart)
            return this.lineChart
        else if (this.isScatter)
            return this.scatter
        else if (this.isStackedArea)
            return this.stackedArea
        else if (this.isSlopeChart)
            return this.slopeChart
        else if (this.isDiscreteBar)
            return this.discreteBar
        else
            throw new Error("No transform found")
    }

    @computed get idealBounds(): Bounds {
        return this.isMediaCard ? new Bounds(0, 0, 1200, 630) : new Bounds(0, 0, 1020, 720)
    }

    @computed get staticSVG(): string {
        const svg = ReactDOMServer.renderToStaticMarkup(<ChartView
            chart={this}
            isExport={true}
            bounds={this.idealBounds}
        />)

        return svg
    }

    @computed get cacheTag(): string {
        return md5(JSON.stringify(this.props))
    }
}
