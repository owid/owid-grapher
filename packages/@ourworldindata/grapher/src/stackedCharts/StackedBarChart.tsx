import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    Time,
    makeSafeForCSS,
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
import { CoreColumn } from "@ourworldindata/core-table"
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
import { StackedBarSegment } from "./StackedBarSegment"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

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
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.chartState.transformedTable.timeDomainFor(
                this.chartState.yColumnSlugs
            )
        )
        axis.formatColumn = this.chartState.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                nice: true,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        // Use user settings for axis, unless relative mode
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings(this.yAxisDomain)
        axis.formatColumn = this.chartState.yColumns[0]
        return axis
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                hideGridlines: true,
                domainValues: this.xValues,
                ticks: this.xValues.map((value) => ({ value, priority: 2 })),
                ...this.manager.xAxisConfig,
            },
            this
        )
    }

    @computed
    get allStackedPoints(): readonly StackedPoint<number>[] {
        return this.stackedSeries.flatMap((series) => series.points)
    }

    @computed private get yAxisDomain(): [number, number] {
        const yValues = this.allStackedPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [_.min([0, ...yValues]) ?? 0, _.max([0, ...yValues]) ?? 0]
    }

    @computed private get barWidth(): number {
        return (this.dualAxis.horizontalAxis.bandWidth ?? 0) * 0.8
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

    @computed private get sidebarWidth(): number {
        if (!this.manager.showLegend) return 0
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
        if (!this.manager.showLegend) {
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

    @computed private get formatColumn(): CoreColumn {
        // we can just use the first column for formatting, b/c we assume all columns have same type
        return this.chartState.yColumns[0]
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const {
            tooltipState: { target, position, fading },
            stackedSeries: series,
            hoveredTick,
            formatColumn,
        } = this

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
                                ? BAR_OPACITY.HOVER
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
        const {
            manager: { showLegend },
            showHorizontalLegend,
        } = this

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
        const {
            dualAxis,
            barWidth,
            tooltipState: { target },
        } = this
        const { verticalAxis, horizontalAxis } = dualAxis

        return (
            <>
                {this.stackedSeries.map((series, index) => {
                    const isLegendHovered = this.hoverKeys.includes(
                        series.seriesName
                    )
                    const opacity =
                        isLegendHovered || this.hoverKeys.length === 0
                            ? BAR_OPACITY.DEFAULT
                            : BAR_OPACITY.MUTE

                    return (
                        <g
                            key={index}
                            id={makeIdForHumanConsumption(series.seriesName)}
                            className={
                                makeSafeForCSS(series.seriesName) + "-segments"
                            }
                        >
                            {series.points.map((bar, index) => {
                                const xPos =
                                    horizontalAxis.place(bar.position) -
                                    this.barWidth / 2
                                const barOpacity =
                                    bar === target?.bar
                                        ? BAR_OPACITY.HOVER
                                        : opacity

                                return (
                                    <StackedBarSegment
                                        key={index}
                                        id={makeIdForHumanConsumption(
                                            this.formatColumn.formatTime(
                                                bar.time
                                            )
                                        )}
                                        bar={bar}
                                        color={bar.color ?? series.color}
                                        xOffset={xPos}
                                        opacity={barOpacity}
                                        yAxis={verticalAxis}
                                        series={series}
                                        onBarMouseOver={this.onBarMouseOver}
                                        onBarMouseLeave={this.onBarMouseLeave}
                                        barWidth={barWidth}
                                    />
                                )
                            })}
                        </g>
                    )
                })}
            </>
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

    @computed private get xValues(): number[] {
        return _.uniq(
            this.chartState.unstackedSeriesWithMissingValuesAsZeroes.flatMap(
                (s) => s.points.map((p) => p.position)
            )
        )
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
