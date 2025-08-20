import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    Time,
    getRelativeMouse,
    excludeUndefined,
    makeIdForHumanConsumption,
    guid,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { DualAxisComponent } from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
    LegendItem,
} from "../verticalColorLegend/VerticalColorLegend"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
} from "../tooltip/Tooltip"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { StackedBarChartState } from "./StackedBarChartState.js"
import { BAR_OPACITY, StackedPoint, StackedSeries } from "./StackedConstants"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { HorizontalAlign } from "@ourworldindata/types"
import { makeClipPath } from "../chart/ChartUtils"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { AxisConfig, AxisManager } from "../axis/AxisConfig.js"
import { easeLinear } from "d3-ease"
import { select, type BaseType, type Selection } from "d3-selection"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { StackedBars } from "./StackedBars"
import { getXAxisConfigDefaultsForStackedBar } from "./StackedUtils"

interface TickmarkPlacement {
    time: number
    text: string
    bounds: Bounds
    isHidden: boolean
}

export type StackedBarChartProps = ChartComponentProps<StackedBarChartState>

@observer
export class StackedBarChart
    extends React.Component<StackedBarChartProps>
    implements
        ChartInterface,
        AxisManager,
        VerticalColorLegendManager,
        HorizontalColorLegendManager
{
    readonly minBarSpacing = 4

    constructor(props: StackedBarChartProps) {
        super(props)

        makeObservable(this, {
            hoverColor: observable,
            hoveredTick: observable,
            tooltipState: observable,
        })
    }

    // currently hovered legend color
    hoverColor: string | undefined = undefined
    // currently hovered axis label
    hoveredTick: TickmarkPlacement | undefined = undefined
    // current hovered individual bar
    tooltipState = new TooltipState<{
        bar: StackedPoint<number>
        series: StackedSeries<number>
    }>()

    @computed get chartState(): StackedBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): ChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed private get renderUid(): number {
        return guid()
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @computed private get innerBounds(): Bounds {
        return (
            this.bounds
                .padTop(this.paddingForLegendTop)
                .padRight(this.paddingForLegendRight)
                // top padding leaves room for tick labels
                .padTop(6)
                // bottom padding avoids axis labels to be cut off at some resolutions
                .padBottom(2)
        )
    }

    @computed private get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { nice: true }
        return new AxisConfig({ ...custom, ...yAxisConfig }, this)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const defaults = getXAxisConfigDefaultsForStackedBar(this.chartState)
        return new AxisConfig({ ...defaults, ...xAxisConfig }, this)
    }

    @computed
    get allStackedPoints(): readonly StackedPoint<number>[] {
        return this.stackedSeries.flatMap((series) => series.points)
    }

    @computed private get showHorizontalLegend(): boolean {
        return !!(this.manager.isSemiNarrow || this.manager.isStaticAndSmall)
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed private get paddingForLegendRight(): number {
        return this.showHorizontalLegend
            ? 0
            : this.sidebarWidth > 0
              ? this.sidebarWidth + 20
              : 0
    }

    @computed private get paddingForLegendTop(): number {
        return this.showHorizontalLegend
            ? this.horizontalColorLegend.height + 8
            : 0
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed private get hoverKeys(): string[] {
        const { hoverColor, manager } = this
        const { externalLegendHoverBin } = manager

        const hoverKeys =
            hoverColor === undefined
                ? []
                : _.uniq(
                      this.stackedSeries
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )
        if (externalLegendHoverBin) {
            hoverKeys.push(
                ...this.chartState.rawSeries
                    .map((g) => g.seriesName)
                    .filter((name) => externalLegendHoverBin.contains(name))
            )
        }

        return hoverKeys
    }

    @computed get activeColors(): string[] {
        const { hoverKeys } = this
        const activeKeys = hoverKeys.length > 0 ? hoverKeys : []

        if (!activeKeys.length)
            // No hover means they're all active by default
            return _.uniq(this.stackedSeries.map((g) => g.color))

        return _.uniq(
            this.stackedSeries
                .filter((g) => activeKeys.indexOf(g.seriesName) !== -1)
                .map((g) => g.color)
        )
    }

    // used by <VerticalColorLegend />
    @computed get legendItems(): (LegendItem &
        Required<Pick<LegendItem, "label">>)[] {
        return this.stackedSeries
            .map((series) => {
                return {
                    label: series.seriesName,
                    color: series.color,
                }
            })
            .toReversed() // Vertical legend orders things in the opposite direction we want
    }

    // used by <HorizontalCategoricalColorLegend />
    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.legendItems.map(
            (legendItem, index) =>
                new CategoricalBin({
                    index,
                    value: legendItem.label,
                    label: legendItem.label,
                    color: legendItem.color,
                })
        )
    }

    @computed get legendWidth(): number {
        return this.showHorizontalLegend
            ? this.bounds.width
            : this.verticalColorLegend.width
    }

    @computed get maxLegendWidth(): number {
        return this.showHorizontalLegend
            ? this.bounds.width
            : this.sidebarMaxWidth
    }

    @computed private get sidebarMaxWidth(): number {
        return this.bounds.width / 5
    }

    @computed private get sidebarMinWidth(): number {
        return 100
    }

    @computed private get showLegend(): boolean {
        return (
            !!this.manager.showLegend &&
            !this.manager.hideLegendsOutsideChartArea
        )
    }

    @computed private get sidebarWidth(): number {
        if (!this.showLegend) return 0
        const {
            sidebarMinWidth,
            sidebarMaxWidth,
            verticalColorLegend: legendDimensions,
        } = this
        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed private get verticalColorLegend(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed
    private get horizontalColorLegend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.showLegend) {
            const categoricalLegendData = this.chartState.unstackedSeries
                .map(
                    (series, index) =>
                        new CategoricalBin({
                            index,
                            value: series.seriesName,
                            label: series.seriesName,
                            color: series.color,
                        })
                )
                .toReversed()
            return { categoricalLegendData }
        }
        return undefined
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const {
            tooltipState: { target, position, fading },
            stackedSeries: series,
            hoveredTick,
        } = this
        const { formatColumn } = this.chartState

        const { bar: hoverBar, series: hoverSeries } = target ?? {}
        let hoverTime: number
        if (hoverBar !== undefined) {
            hoverTime = hoverBar.position
        } else if (hoveredTick !== undefined) {
            hoverTime = hoveredTick.time
        } else return

        const title = formatColumn.formatTime(hoverTime)
        const titleAnnotation = this.xAxis.label ? `(${this.xAxis.label})` : ""

        const { unit, shortUnit } = formatColumn

        const totalValue = _.sum(
            series.map(
                ({ points }) =>
                    points.find((bar) => bar.position === hoverTime)?.value ?? 0
            )
        )

        const roundingNotice = formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
                  text: makeTooltipRoundingNotice([
                      formatColumn.numSignificantFigures,
                  ]),
              }
            : undefined
        const footer = excludeUndefined([roundingNotice])

        const hoverPoints = series.map((series) => {
            const point = series.points.find(
                (bar) => bar.position === hoverTime
            )
            return {
                seriesName: series.seriesName,
                seriesColor: series.color,
                point,
            }
        })
        const [positivePoints, negativePoints] = _.partition(
            hoverPoints,
            ({ point }) => (point?.value ?? 0) >= 0
        )
        const sortedHoverPoints = [
            ...positivePoints.toReversed(),
            ...negativePoints,
        ]

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "500px" }}
                offsetX={20}
                offsetY={-16}
                title={title}
                titleAnnotation={titleAnnotation}
                subtitle={unit !== shortUnit ? unit : undefined}
                subtitleFormat="unit"
                footer={footer}
                dissolve={fading}
                dismiss={() => (this.tooltipState.target = null)}
            >
                <TooltipTable
                    columns={[formatColumn]}
                    totals={[totalValue]}
                    rows={sortedHoverPoints.map(
                        ({ point, seriesName: name, seriesColor }) => {
                            const focused = hoverSeries?.seriesName === name
                            const blurred = point?.fake ?? true
                            const values = [
                                point?.fake ? undefined : point?.value,
                            ]

                            const color = point?.color ?? seriesColor
                            const opacity = focused
                                ? BAR_OPACITY.FOCUS
                                : BAR_OPACITY.DEFAULT
                            const swatch = { color, opacity }

                            return { name, swatch, blurred, focused, values }
                        }
                    )}
                />
            </Tooltip>
        )
    }

    // Both legend managers accept a `onLegendMouseOver` property, but define different signatures.
    // The <HorizontalCategoricalColorLegend /> component expects a string,
    // the <VerticalColorLegend /> component expects a ColorScaleBin.
    @action.bound onLegendMouseOver(binOrColor: string | ColorScaleBin): void {
        this.hoverColor =
            typeof binOrColor === "string" ? binOrColor : binOrColor.color
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoverColor = undefined
    }

    @action.bound onLabelMouseOver(tick: TickmarkPlacement): void {
        this.hoveredTick = tick
    }

    @action.bound onLabelMouseLeave(): void {
        this.hoveredTick = undefined
    }

    @action.bound onBarMouseOver(
        bar: StackedPoint<Time>,
        series: StackedSeries<Time>
    ): void {
        this.tooltipState.target = { bar, series }
    }

    @action.bound private onMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound onBarMouseLeave(): void {
        this.tooltipState.target = null
    }

    renderLegend(): React.ReactElement | undefined {
        const { showLegend, showHorizontalLegend } = this

        if (!showLegend) return

        return showHorizontalLegend ? (
            <HorizontalCategoricalColorLegend manager={this} />
        ) : (
            <VerticalColorLegend manager={this} />
        )
    }

    renderAxis(): React.ReactElement {
        const { manager } = this

        return (
            <DualAxisComponent
                dualAxis={this.dualAxis}
                showTickMarks={true}
                detailsMarker={manager.detailsMarkerInSvg}
                backgroundColor={this.manager.backgroundColor}
            />
        )
    }

    renderBars(): React.ReactElement {
        return (
            <StackedBars
                dualAxis={this.dualAxis}
                series={this.stackedSeries}
                formatColumn={this.chartState.formatColumn}
                hoveredSeriesNames={this.hoverKeys}
                hoveredBar={this.tooltipState.target?.bar}
                onBarMouseOver={this.onBarMouseOver}
                onBarMouseLeave={this.onBarMouseLeave}
            />
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderAxis()}
                <g id={makeIdForHumanConsumption("bars")}>
                    {this.renderBars()}
                </g>
                {this.renderLegend()}
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        const { dualAxis, renderUid, bounds } = this
        const { innerBounds } = dualAxis

        const clipPath = makeClipPath({
            renderUid: renderUid,
            box: innerBounds,
        })

        return (
            <g
                className="StackedBarChart"
                width={bounds.width}
                height={bounds.height}
                onMouseMove={this.onMouseMove}
            >
                {clipPath.element}
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.renderAxis()}
                <g clipPath={clipPath.id}>{this.renderBars()}</g>
                {this.renderLegend()}
                {this.tooltip}
            </g>
        )
    }

    override render(): React.ReactElement {
        const { dualAxis, bounds } = this

        if (this.chartState.errorInfo.reason)
            return (
                <g
                    className="StackedBarChart"
                    width={bounds.width}
                    height={bounds.height}
                >
                    {this.renderAxis()}
                    <NoDataModal
                        manager={this.manager}
                        bounds={dualAxis.innerBounds}
                        message={this.chartState.errorInfo.reason}
                    />
                </g>
            )

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendY(): number {
        return this.bounds.top
    }

    @computed get legendX(): number {
        return this.showHorizontalLegend
            ? this.bounds.left
            : this.bounds.right - this.sidebarWidth
    }

    @computed
    get stackedSeries(): readonly StackedSeries<number>[] {
        return this.chartState.series
    }

    animSelection?: Selection<BaseType, unknown, SVGGElement | null, unknown>

    base = React.createRef<SVGGElement>()
    override componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
            // Fancy intro animation
            this.animSelection = select(this.base.current)
                .selectAll("clipPath > rect")
                .attr("width", 0)

            this.animSelection
                .transition()
                .duration(800)
                .ease(easeLinear)
                .attr("width", this.bounds.width)
                .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
        }
        exposeInstanceOnWindow(this)
    }

    override componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }
}
