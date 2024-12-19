import React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    Time,
    uniq,
    makeSafeForCSS,
    sum,
    getRelativeMouse,
    excludeUndefined,
    min,
    max,
    partition,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { DualAxisComponent, HorizonalAxisLabel } from "../axis/AxisViews"
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
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_FOCUS,
    GRAPHER_AREA_OPACITY_MUTE,
    GRAPHER_AXIS_LINE_WIDTH_DEFAULT,
    GRAPHER_AXIS_LINE_WIDTH_THICK,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { ColorScaleManager } from "../color/ColorScale"
import {
    AbstractStackedChart,
    AbstractStackedChartProps,
} from "./AbstractStackedChart"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { VerticalAxis } from "../axis/Axis"
import { ColorSchemeName, HorizontalAlign } from "@ourworldindata/types"
import {
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils"
import { makeClipPath } from "../chart/ChartUtils"
import { ColorScaleConfigDefaults } from "../color/ColorScaleConfig"
import { ColumnTypeMap, CoreColumn } from "@ourworldindata/core-table"
import { HorizontalCategoricalColorLegend } from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { AxisConfig } from "../axis/AxisConfig.js"

interface StackedBarSegmentProps extends React.SVGAttributes<SVGGElement> {
    id: string
    bar: StackedPoint<Time>
    series: StackedSeries<Time>
    color: string
    opacity: number
    yAxis: VerticalAxis
    xOffset: number
    barWidth: number
    onBarMouseOver: (
        bar: StackedPoint<Time>,
        series: StackedSeries<Time>
    ) => void
    onBarMouseLeave: () => void
}

interface TickmarkPlacement {
    time: number
    text: string
    bounds: Bounds
    isHidden: boolean
}

const BAR_OPACITY = {
    DEFAULT: GRAPHER_AREA_OPACITY_DEFAULT,
    FOCUS: GRAPHER_AREA_OPACITY_FOCUS,
    MUTE: GRAPHER_AREA_OPACITY_MUTE,
}

@observer
class StackedBarSegment extends React.Component<StackedBarSegmentProps> {
    base: React.RefObject<SVGRectElement> = React.createRef()

    @observable mouseOver: boolean = false

    @computed get yPos(): number {
        const { bar, yAxis } = this.props
        // The top position of a bar
        return bar.value < 0
            ? yAxis.place(bar.valueOffset)
            : yAxis.place(bar.value + bar.valueOffset)
    }

    @computed get barHeight(): number {
        const { bar, yAxis } = this.props
        return bar.value < 0
            ? yAxis.place(bar.valueOffset + bar.value) - this.yPos
            : yAxis.place(bar.valueOffset) - this.yPos
    }

    @computed get trueOpacity(): number {
        return this.mouseOver ? BAR_OPACITY.FOCUS : this.props.opacity
    }

    @action.bound onBarMouseOver(): void {
        this.mouseOver = true
        this.props.onBarMouseOver(this.props.bar, this.props.series)
    }

    @action.bound onBarMouseLeave(): void {
        this.mouseOver = false
        this.props.onBarMouseLeave()
    }

    render(): React.ReactElement {
        const { color, xOffset, barWidth } = this.props
        const { yPos, barHeight, trueOpacity } = this

        return (
            <rect
                id={this.props.id}
                ref={this.base}
                x={xOffset}
                y={yPos}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity={trueOpacity}
                onMouseOver={this.onBarMouseOver}
                onMouseLeave={this.onBarMouseLeave}
            />
        )
    }
}

@observer
export class StackedBarChart
    extends AbstractStackedChart
    implements VerticalColorLegendManager, ColorScaleManager
{
    readonly minBarSpacing = 4

    constructor(props: AbstractStackedChartProps) {
        super(props)
    }

    // currently hovered legend color
    @observable hoverColor?: string
    // currently hovered axis label
    @observable hoveredTick?: TickmarkPlacement
    // current hovered individual bar
    @observable tooltipState = new TooltipState<{
        bar: StackedPoint<number>
        series: StackedSeries<number>
    }>()

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get tickFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.baseFontSize
    }

    @computed protected get xAxisConfig(): AxisConfig {
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

    @computed protected get yAxisDomain(): [number, number] {
        const yValues = this.allStackedPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [min([0, ...yValues]) ?? 0, max([0, ...yValues]) ?? 0]
    }

    @computed get barWidth(): number {
        return (this.dualAxis.horizontalAxis.bandWidth ?? 0) * 0.8
    }

    @computed private get showHorizontalLegend(): boolean {
        return !!(this.manager.isSemiNarrow || this.manager.isStaticAndSmall)
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed protected get paddingForLegendRight(): number {
        return this.showHorizontalLegend
            ? 0
            : this.sidebarWidth > 0
              ? this.sidebarWidth + 20
              : 0
    }

    @computed protected get paddingForLegendTop(): number {
        return this.showHorizontalLegend
            ? this.horizontalColorLegend.height + 8
            : 0
    }

    @computed get shouldRunLinearInterpolation(): boolean {
        // disabled by default
        return this.props.enableLinearInterpolation ?? false
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys(): string[] {
        const { hoverColor, manager } = this
        const { externalLegendHoverBin } = manager

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )
        if (externalLegendHoverBin) {
            hoverKeys.push(
                ...this.rawSeries
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
            return uniq(this.series.map((g) => g.color))

        return uniq(
            this.series
                .filter((g) => activeKeys.indexOf(g.seriesName) !== -1)
                .map((g) => g.color)
        )
    }

    // used by <VerticalColorLegend />
    @computed get legendItems(): (LegendItem &
        Required<Pick<LegendItem, "label">>)[] {
        return this.series
            .map((series) => {
                return {
                    label: series.seriesName,
                    color: series.color,
                }
            })
            .reverse() // Vertical legend orders things in the opposite direction we want
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

    @computed get sidebarMaxWidth(): number {
        return this.bounds.width / 5
    }

    @computed get sidebarMinWidth(): number {
        return 100
    }

    @computed get sidebarWidth(): number {
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

    @computed get formatColumn(): CoreColumn {
        // we can just use the first column for formatting, b/c we assume all columns have same type
        return this.yColumns[0]
    }

    @computed get tooltip(): React.ReactElement | undefined {
        const {
            tooltipState: { target, position, fading },
            series,
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

        const { unit, shortUnit } = formatColumn

        const totalValue = sum(
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
        const [positivePoints, negativePoints] = partition(
            hoverPoints,
            ({ point }) => (point?.value ?? 0) >= 0
        )
        const sortedHoverPoints = [
            ...positivePoints.slice().reverse(),
            ...negativePoints,
        ]

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.props.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "500px" }}
                offsetX={20}
                offsetY={-16}
                title={formatColumn.formatTime(hoverTime)}
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

    renderLegend(): React.ReactElement | void {
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

        const lineWidth = manager.isStaticAndSmall
            ? GRAPHER_AXIS_LINE_WIDTH_THICK
            : GRAPHER_AXIS_LINE_WIDTH_DEFAULT

        return (
            <>
                <DualAxisComponent
                    dualAxis={this.dualAxis}
                    showTickMarks={true}
                    lineWidth={lineWidth}
                />
                {this.horizontalAxisLabelWrap && (
                    <HorizonalAxisLabel
                        textWrap={this.horizontalAxisLabelWrap}
                        dualAxis={this.dualAxis}
                        color={manager.secondaryColorInStaticCharts}
                    />
                )}
            </>
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
                {this.series.map((series, index) => {
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
                                        ? BAR_OPACITY.FOCUS
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

        const clipPath = makeClipPath(renderUid, innerBounds)

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

    render(): React.ReactElement {
        const { dualAxis, bounds } = this

        if (this.failMessage)
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
                        message={this.failMessage}
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

    @computed get colorScaleConfig(): ColorScaleConfigDefaults | undefined {
        return this.manager.colorScale
    }

    defaultBaseColorScheme = ColorSchemeName.stackedAreaDefault

    /**
     * Colour positive and negative values differently if there is only one series
     * (and that series has both positive and negative values)
     */
    @computed get shouldUseValueBasedColorScheme(): boolean {
        return (
            this.rawSeries.length === 1 &&
            this.rawSeries[0].rows.some((row) => row.value < 0) &&
            this.rawSeries[0].rows.some((row) => row.value > 0)
        )
    }

    @computed get useValueBasedColorScheme(): boolean {
        return (
            this.manager.useValueBasedColorScheme ||
            this.shouldUseValueBasedColorScheme
        )
    }

    @computed
    private get unstackedSeriesWithMissingValuesAsZeroes(): StackedSeries<number>[] {
        // TODO: remove once monthly data is supported (https://github.com/owid/owid-grapher/issues/2007)
        const enforceUniformSpacing = !(
            this.transformedTable.timeColumn instanceof ColumnTypeMap.Day
        )

        return withMissingValuesAsZeroes(this.unstackedSeries, {
            enforceUniformSpacing,
        })
    }

    @computed private get xValues(): number[] {
        return uniq(
            this.unstackedSeriesWithMissingValuesAsZeroes.flatMap((s) =>
                s.points.map((p) => p.position)
            )
        )
    }

    @computed
    get series(): readonly StackedSeries<number>[] {
        return stackSeriesInBothDirections(
            this.unstackedSeriesWithMissingValuesAsZeroes
        )
    }
}
