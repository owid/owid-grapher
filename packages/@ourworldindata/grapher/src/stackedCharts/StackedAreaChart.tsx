import React from "react"
import {
    extend,
    reverse,
    clone,
    last,
    pointsToPath,
    getRelativeMouse,
    makeSafeForCSS,
    minBy,
    excludeUndefined,
    isMobile,
    Time,
    lastOfNonEmptyArray,
} from "@ourworldindata/utils"
import { computed, action, observable } from "mobx"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AXIS_LINE_WIDTH_DEFAULT,
    GRAPHER_AXIS_LINE_WIDTH_THICK,
    SeriesName,
} from "../core/GrapherConstants"
import { observer } from "mobx-react"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis } from "../axis/Axis"
import {
    LineLabelSeries,
    LineLegend,
    LineLegendManager,
} from "../lineLegend/LineLegend"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { Tooltip, TooltipState, TooltipTable } from "../tooltip/Tooltip"
import { rgb } from "d3-color"
import {
    AbstractStackedChart,
    AbstractStackedChartProps,
} from "../stackedCharts/AbstractStackedChart"
import {
    StackedPlacedPoint,
    StackedPlacedSeries,
    StackedPoint,
    StackedSeries,
} from "./StackedConstants"
import { stackSeries, withMissingValuesAsZeroes } from "./StackedUtils"
import { makeClipPath } from "../chart/ChartUtils"
import { bind } from "decko"

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    seriesArr: readonly StackedSeries<Time>[]
    focusedSeriesNames: SeriesName[]
    hoveredAreaName?: SeriesName
    onAreaMouseEnter: (seriesName: SeriesName) => void
    onAreaMouseLeave: () => void
}

const BLUR_COLOR = "#ddd"

@observer
class Areas extends React.Component<AreasProps> {
    private seriesIsBlur(series: StackedSeries<Time>): boolean {
        return (
            this.props.focusedSeriesNames.length > 0 &&
            !this.props.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @bind placePoint(point: StackedPoint<number>): StackedPlacedPoint {
        const { dualAxis } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        return [
            horizontalAxis.place(point.position),
            verticalAxis.place(point.value + point.valueOffset),
        ]
    }

    // This places a whole series, but the points only represent the top of the area.
    // Later steps are necessary to display them as a filled area.
    @bind placeSeries(
        series: StackedSeries<number>
    ): Array<StackedPlacedPoint> {
        const { dualAxis } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        if (series.points.length > 1) {
            return series.points.map(this.placePoint)
        } else if (series.points.length === 1) {
            // We only have one point, so make it so it stretches out over the whole x axis range
            // There are two cases here that we need to consider:
            // (1) In unfaceted charts, the x domain will be a single year, so we need to ensure that the area stretches
            //     out over the full range of the x axis.
            // (2) In faceted charts, the x domain may span multiple years, so we need to ensure that the area stretches
            //     out only over year - 0.5 to year + 0.5, additionally making sure we don't put points outside the x range.
            //
            // -@marcelgerber, 2023-04-24
            const point = series.points[0]
            const y = verticalAxis.place(point.value + point.valueOffset)
            const singleValueXDomain =
                horizontalAxis.domain[0] === horizontalAxis.domain[1]

            if (singleValueXDomain) {
                // Case (1)
                return [
                    [horizontalAxis.range[0], y],
                    [horizontalAxis.range[1], y],
                ]
            } else {
                // Case (2)
                const leftX = Math.max(
                    horizontalAxis.place(point.position - 0.5),
                    horizontalAxis.range[0]
                )
                const rightX = Math.min(
                    horizontalAxis.place(point.position + 0.5),
                    horizontalAxis.range[1]
                )

                return [
                    [leftX, y],
                    [rightX, y],
                ]
            }
        } else return []
    }

    @computed get placedSeriesArr(): StackedPlacedSeries<number>[] {
        const { seriesArr } = this.props
        return seriesArr
            .filter((series) => !series.isAllZeros)
            .map((series) => ({
                ...series,
                placedPoints: this.placeSeries(series),
            }))
    }

    @computed private get areas(): JSX.Element[] {
        const { placedSeriesArr } = this
        const { dualAxis, hoveredAreaName } = this.props
        const { verticalAxis } = dualAxis

        return placedSeriesArr.map((series, index) => {
            const { placedPoints } = series
            let prevPoints: Array<StackedPlacedPoint>
            if (index > 0) {
                prevPoints = placedSeriesArr[index - 1].placedPoints
            } else {
                prevPoints = prevPoints = [
                    [
                        placedPoints[0][0], // placed x coord of first (= leftmost) point in chart
                        verticalAxis.range[0],
                    ],
                    [
                        lastOfNonEmptyArray(placedPoints)[0], // placed x coord of last (= rightmost) point in chart
                        verticalAxis.range[0],
                    ],
                ]
            }
            const points = [...placedPoints, ...reverse(clone(prevPoints))]
            const opacity = !hoveredAreaName
                ? GRAPHER_AREA_OPACITY_DEFAULT // normal opacity
                : hoveredAreaName === series.seriesName
                ? GRAPHER_AREA_OPACITY_DEFAULT // hovered
                : 0.2 // non-hovered

            return (
                <path
                    className={makeSafeForCSS(series.seriesName) + "-area"}
                    key={series.seriesName + "-area"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    fill={this.seriesIsBlur(series) ? BLUR_COLOR : series.color}
                    fillOpacity={opacity}
                    clipPath={this.props.clipPath}
                    onMouseEnter={(): void => {
                        this.props.onAreaMouseEnter(series.seriesName)
                    }}
                    onMouseLeave={(): void => {
                        this.props.onAreaMouseLeave()
                    }}
                />
            )
        })
    }

    @computed private get borders(): JSX.Element[] {
        const { placedSeriesArr } = this
        const { hoveredAreaName } = this.props

        return placedSeriesArr.map((placedSeries) => {
            const opacity =
                hoveredAreaName === placedSeries.seriesName
                    ? 1 // hovered
                    : 0.7 // non-hovered
            const weight =
                hoveredAreaName === placedSeries.seriesName ? 1.5 : 0.5

            return (
                <path
                    className={
                        makeSafeForCSS(placedSeries.seriesName) + "-border"
                    }
                    key={placedSeries.seriesName + "-border"}
                    strokeLinecap="round"
                    d={pointsToPath(placedSeries.placedPoints)}
                    stroke={rgb(
                        this.seriesIsBlur(placedSeries)
                            ? BLUR_COLOR
                            : placedSeries.color
                    )
                        .darker(0.5)
                        .toString()}
                    strokeOpacity={opacity}
                    strokeWidth={weight}
                    fill="none"
                    clipPath={this.props.clipPath}
                    onMouseEnter={(): void => {
                        this.props.onAreaMouseEnter(placedSeries.seriesName)
                    }}
                    onMouseLeave={(): void => {
                        this.props.onAreaMouseLeave()
                    }}
                />
            )
        })
    }

    render(): JSX.Element {
        const { dualAxis } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        return (
            <g className="Areas">
                <rect
                    x={horizontalAxis.range[0]}
                    y={verticalAxis.range[1]}
                    width={horizontalAxis.range[1] - horizontalAxis.range[0]}
                    height={verticalAxis.range[0] - verticalAxis.range[1]}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.areas}
                {this.borders}
            </g>
        )
    }
}

@observer
export class StackedAreaChart
    extends AbstractStackedChart
    implements LineLegendManager
{
    constructor(props: AbstractStackedChartProps) {
        super(props)
    }

    @computed get midpoints(): number[] {
        let prevY = 0
        return this.series.map((series) => {
            const lastValue = last(series.points)
            if (!lastValue) return 0

            const y = lastValue.value + lastValue.valueOffset
            const middleY = prevY + (y - prevY) / 2
            prevY = y
            return middleY
        })
    }

    @computed get labelSeries(): LineLabelSeries[] {
        const { midpoints } = this
        return this.series
            .map((series, index) => ({
                color: series.color,
                seriesName: series.seriesName,
                label: series.seriesName,
                yValue: midpoints[index],
                isAllZeros: series.isAllZeros,
            }))
            .filter((series) => !series.isAllZeros)
            .reverse()
    }

    @computed get maxLineLegendWidth(): number {
        return Math.min(150, this.bounds.width / 3)
    }

    @computed get legendDimensions(): LineLegend | undefined {
        if (this.manager.hideLegend) return undefined
        return new LineLegend({ manager: this })
    }

    @observable tooltipState = new TooltipState<{
        index: number // time-index into points array
        series?: SeriesName
    }>({ fade: "immediate" })

    @action.bound private onAreaMouseEnter(seriesName: SeriesName): void {
        extend(this.tooltipState.target, { series: seriesName })
    }

    @action.bound private onAreaMouseLeave(): void {
        extend(this.tooltipState.target, { series: undefined })
    }

    @observable hoverSeriesName?: SeriesName
    @action.bound onLineLegendClick(): void {
        if (this.manager.startSelectingWhenLineClicked)
            this.manager.isSelectingData = true
    }

    @computed protected get paddingForLegend(): number {
        const { legendDimensions } = this
        return legendDimensions ? legendDimensions.width : 20
    }

    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        this.hoverSeriesName = seriesName
    }

    @action.bound onLineLegendMouseLeave(): void {
        this.hoverSeriesName = undefined
    }

    @computed get focusedSeriesNames(): string[] {
        const { externalLegendFocusBin } = this.manager
        const focusedSeriesNames = excludeUndefined([
            this.props.manager.annotation?.entityName,
            this.hoverSeriesName,
        ])
        if (externalLegendFocusBin) {
            focusedSeriesNames.push(
                ...this.rawSeries
                    .map((s) => s.seriesName)
                    .filter((name) => externalLegendFocusBin.contains(name))
            )
        }
        return focusedSeriesNames
    }

    @computed get isFocusMode(): boolean {
        return this.focusedSeriesNames.length > 0
    }

    seriesIsBlur(series: StackedSeries<Time>): boolean {
        return (
            this.focusedSeriesNames.length > 0 &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @action.bound private onCursorMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ): void {
        const ref = this.base.current,
            parentRef = this.manager.base?.current

        // the tooltip's origin needs to be in the parent's coordinates
        if (parentRef) {
            this.tooltipState.position = getRelativeMouse(parentRef, ev)
        }

        if (!ref) return undefined

        const { series } = this
        const mouse = getRelativeMouse(ref, ev.nativeEvent)
        const boxPadding = isMobile() ? 44 : 25

        // expand the box width, so it's easier to see the tooltip for the first & last timepoints
        const boundedBox = this.dualAxis.innerBounds.expand({
            left: boxPadding,
            right: boxPadding,
        })

        let hoveredIndex
        if (boundedBox.contains(mouse)) {
            const invertedX = this.dualAxis.horizontalAxis.invert(mouse.x)
            const closestPoint = minBy(series[0].points, (d) =>
                Math.abs(d.position - invertedX)
            )
            if (closestPoint) {
                const index = series[0].points.indexOf(closestPoint)
                hoveredIndex = index
            }
        }
        this.tooltipState.target =
            hoveredIndex === undefined
                ? null
                : {
                      index: hoveredIndex,
                      series: this.tooltipState.target?.series,
                  }
    }

    @action.bound private onCursorLeave(): void {
        this.hoverSeriesName = undefined
        this.tooltipState.target = null
    }

    @computed private get activeXVerticalLine(): JSX.Element | undefined {
        const { dualAxis, series } = this
        const { horizontalAxis, verticalAxis } = dualAxis
        const hoveredPointIndex = this.tooltipState.target?.index

        if (hoveredPointIndex === undefined) return undefined

        return (
            // disable pointer events to avoid interfering with enter/leave tracking of areas
            <g className="hoverIndicator" style={{ pointerEvents: "none" }}>
                {series.map((series) => {
                    const point = series.points[hoveredPointIndex]
                    return this.seriesIsBlur(series) ||
                        point.fake ||
                        point.value === 0 ? null : (
                        <circle
                            key={series.seriesName}
                            cx={horizontalAxis.place(point.position)}
                            cy={verticalAxis.place(
                                point.value + point.valueOffset
                            )}
                            r={2}
                            fill={series.color}
                        />
                    )
                })}
                <line
                    x1={horizontalAxis.place(
                        series[0].points[hoveredPointIndex].position
                    )}
                    y1={verticalAxis.range[0]}
                    x2={horizontalAxis.place(
                        series[0].points[hoveredPointIndex].position
                    )}
                    y2={verticalAxis.range[1]}
                    stroke="rgba(180,180,180,.4)"
                />
            </g>
        )
    }

    @computed private get tooltip(): JSX.Element | undefined {
        const { target, position, fading } = this.tooltipState
        if (!target) return undefined

        // Grab the first value to get the year from
        const { series } = this
        const hoveredPointIndex = target.index
        const bottomSeriesPoint = series[0].points[hoveredPointIndex]

        const yColumn = this.yColumns[0], // Assumes same type for all columns.
            formattedTime = yColumn.formatTime(bottomSeriesPoint.position),
            { unit, shortUnit } = yColumn

        const lastStackedPoint = last(series)!.points[hoveredPointIndex]
        const totalValue = lastStackedPoint.value + lastStackedPoint.valueOffset

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.props.manager}
                x={position.x}
                y={position.y}
                offsetY={-16}
                offsetX={20}
                offsetXDirection="left"
                style={{ maxWidth: "50%" }}
                title={formattedTime}
                subtitle={unit !== shortUnit ? unit : undefined}
                subtitleFormat="unit"
                dissolve={fading}
            >
                <TooltipTable
                    columns={[yColumn]}
                    totals={[totalValue]}
                    rows={series
                        .slice()
                        .reverse()
                        .map((series) => {
                            const {
                                seriesName: name,
                                color: swatch,
                                points,
                            } = series
                            const point = points[hoveredPointIndex]
                            const blurred = this.seriesIsBlur(series)
                            const focused = name === target.series
                            const values = [
                                point?.fake ? undefined : point?.value,
                            ]

                            return { name, swatch, focused, blurred, values }
                        })}
                />
            </Tooltip>
        )
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, bounds, dualAxis, renderUid, series } = this
        const { target } = this.tooltipState

        const showLegend = !this.manager.hideLegend

        const clipPath = makeClipPath(renderUid, {
            ...bounds,
            height: bounds.height * 2,
            x: dualAxis.innerBounds.x,
        })

        return (
            <g
                ref={this.base}
                className="StackedArea"
                onMouseLeave={this.onCursorLeave}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
                onMouseMove={this.onCursorMove}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
            >
                {clipPath.element}
                <rect {...this.bounds.toProps()} fill="none">
                    {/* This <rect> ensures that the parent <g> is big enough such that we get mouse hover events for the
                    whole charting area, including the axis, the entity labels, and the whitespace next to them.
                    We need these to be able to show the tooltip for the first/last year even if the mouse is outside the charting area. */}
                </rect>
                <DualAxisComponent
                    dualAxis={dualAxis}
                    showTickMarks={true}
                    labelColor={manager.secondaryColorInStaticCharts}
                    lineWidth={
                        manager.isStaticAndSmall
                            ? GRAPHER_AXIS_LINE_WIDTH_THICK
                            : GRAPHER_AXIS_LINE_WIDTH_DEFAULT
                    }
                />
                <g clipPath={clipPath.id}>
                    {showLegend && <LineLegend manager={this} />}
                    <Areas
                        dualAxis={dualAxis}
                        seriesArr={series}
                        focusedSeriesNames={this.focusedSeriesNames}
                        hoveredAreaName={target?.series}
                        onAreaMouseEnter={this.onAreaMouseEnter}
                        onAreaMouseLeave={this.onAreaMouseLeave}
                    />
                </g>
                {this.activeXVerticalLine}
                {this.tooltip}
            </g>
        )
    }

    @computed get lineLegendX(): number {
        return this.legendDimensions
            ? this.bounds.right - this.legendDimensions.width
            : 0
    }

    @computed get series(): readonly StackedSeries<number>[] {
        return stackSeries(withMissingValuesAsZeroes(this.unstackedSeries))
    }
}
