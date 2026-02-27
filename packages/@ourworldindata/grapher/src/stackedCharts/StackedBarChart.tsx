import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    Time,
    getRelativeMouse,
    excludeUndefined,
    makeFigmaId,
    guid,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { DualAxisComponent } from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "../legend/VerticalColorLegend"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { StackedBarChartState } from "./StackedBarChartState.js"
import {
    BAR_OPACITY,
    LEGEND_STYLE_FOR_STACKED_CHARTS,
    StackedPoint,
    StackedSeries,
    PlacedStackedBarSeries,
} from "./StackedConstants"
import { LegendInteractionState } from "../legend/LegendInteractionState"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { Color, HorizontalAlign, SeriesName } from "@ourworldindata/types"
import { makeClipPath, getHoverStateForSeries } from "../chart/ChartUtils"
import { InteractionState } from "../interaction/InteractionState"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../legend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { AxisConfig, AxisManager } from "../axis/AxisConfig.js"
import { easeLinear } from "d3-ease"
import { select, type BaseType, type Selection } from "d3-selection"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { StackedBars } from "./StackedBars"
import {
    getXAxisConfigDefaultsForStackedBar,
    toPlacedStackedBarSeries,
} from "./StackedUtils"

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
            legendHoverColor: observable,
            tooltipState: observable,
        })
    }

    /** Currently hovered legend color */
    legendHoverColor: Color | undefined = undefined

    tooltipState = new TooltipState<{
        bar: StackedPoint<Time>
        series: StackedSeries<Time>
    }>()

    legendStyleConfig = LEGEND_STYLE_FOR_STACKED_CHARTS

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
        return this.series.flatMap((series) => series.points)
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

    /** Series names matching the currently hovered legend item in the color legend */
    @computed private get legendHoveredSeriesNames(): SeriesName[] {
        const { legendHoverColor } = this

        if (!legendHoverColor) return []

        return _.uniq(
            this.series
                .filter((g) => g.color === legendHoverColor)
                .map((g) => g.seriesName)
        )
    }

    /** Series names matching the currently hovered legend item in the external facet legend */
    @computed private get externalLegendHoveredSeriesNames(): SeriesName[] {
        const { externalLegendHoverBin } = this.manager

        if (!externalLegendHoverBin) return []

        return this.chartState.rawSeries
            .map((g) => g.seriesName)
            .filter((name) => externalLegendHoverBin.contains(name))
    }

    @computed private get hoveredSeriesNames(): SeriesName[] {
        return _.uniq([
            ...this.legendHoveredSeriesNames,
            ...this.externalLegendHoveredSeriesNames,
        ])
    }

    @computed private get isHoverModeActive(): boolean {
        return (
            this.hoveredSeriesNames.length > 0 ||
            !!this.manager.externalLegendHoverBin
        )
    }

    private hoverStateForSeries(series: StackedSeries<Time>): InteractionState {
        return getHoverStateForSeries(series, {
            hoveredSeriesNames: this.hoveredSeriesNames,
            isHoverModeActive: this.isHoverModeActive,
        })
    }

    /** All colors that are currently hovered or focused */
    @computed get activeColors(): string[] {
        const hoveredSeriesNamesSet = new Set(this.hoveredSeriesNames)
        const hoveredColors = this.series
            .filter((g) => hoveredSeriesNamesSet.has(g.seriesName))
            .map((g) => g.color)

        const focusedColors = this.series
            .filter((g) => g.focus?.active)
            .map((g) => g.color)

        const activeColors = _.uniq(
            excludeUndefined([...focusedColors, ...hoveredColors])
        )

        return activeColors
    }

    getLegendBinState(bin: ColorScaleBin): LegendInteractionState {
        const isActive = this.activeColors?.includes(bin.color)

        if (this.activeColors.length === 0)
            return LegendInteractionState.Default

        return isActive
            ? LegendInteractionState.Focused
            : LegendInteractionState.Muted
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.series
            .map(
                (series, index) =>
                    new CategoricalBin({
                        index,
                        value: series.seriesName,
                        label: series.seriesName,
                        color: series.color,
                    })
            )
            .toReversed() // Vertical legend orders things in the opposite direction we want
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
            !this.manager.isDisplayedAlongsideComplementaryTable
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

            return {
                categoricalLegendData,
                legendStyleConfig: this.legendStyleConfig,
            }
        }
        return undefined
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const {
            tooltipState: { target, position, fading },
            series,
        } = this
        const { formatColumn } = this.chartState

        const { bar: hoverBar, series: hoverSeries } = target ?? {}
        let hoverTime: number
        if (hoverBar !== undefined) {
            hoverTime = hoverBar.position
        } else return

        const title = formatColumn.formatTime(hoverTime)
        const titleAnnotation = this.xAxis.label ? `(${this.xAxis.label})` : ""

        const { displayUnit } = formatColumn

        const totalValue = _.sum(
            series.map(
                ({ points }) =>
                    points.find((bar) => bar.position === hoverTime)?.value ?? 0
            )
        )

        const roundingNotice = formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.None,
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
                subtitle={displayUnit}
                subtitleFormat="unit"
                footer={footer}
                dissolve={fading}
                dismiss={() => (this.tooltipState.target = null)}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(formatColumn)}
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

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.legendHoverColor = bin.color
    }

    @action.bound onLegendMouseLeave(): void {
        this.legendHoverColor = undefined
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
                series={this.renderSeries}
                formatColumn={this.chartState.formatColumn}
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
                <g id={makeFigmaId("bars")}>{this.renderBars()}</g>
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
        // Small offset aligns the legend with the chart area's top edge in relative mode
        return this.bounds.top + 3
    }

    @computed get legendX(): number {
        return this.showHorizontalLegend
            ? this.bounds.left
            : this.bounds.right - this.sidebarWidth
    }

    @computed get series(): readonly StackedSeries<Time>[] {
        return this.chartState.series
    }

    @computed
    private get placedSeries(): readonly PlacedStackedBarSeries<Time>[] {
        return toPlacedStackedBarSeries(this.series, this.dualAxis)
    }

    @computed
    private get renderSeries(): readonly PlacedStackedBarSeries<Time>[] {
        return this.placedSeries.map((series) => ({
            ...series,
            hover: this.hoverStateForSeries(series),
        }))
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
