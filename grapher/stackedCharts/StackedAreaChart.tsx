import React from "react"
import {
    reverse,
    clone,
    last,
    pointsToPath,
    getRelativeMouse,
    makeSafeForCSS,
    minBy,
    excludeUndefined,
    isMobile,
} from "../../clientUtils/Util.js"
import { computed, action, observable } from "mobx"
import { SeriesName } from "../core/GrapherConstants.js"
import { observer } from "mobx-react"
import { DualAxisComponent } from "../axis/AxisViews.js"
import { DualAxis } from "../axis/Axis.js"
import {
    LineLabelSeries,
    LineLegend,
    LineLegendManager,
} from "../lineLegend/LineLegend.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { Tooltip } from "../tooltip/Tooltip.js"
import { rgb } from "d3-color"
import {
    AbstractStackedChart,
    AbstractStackedChartProps,
} from "../stackedCharts/AbstractStackedChart.js"
import { StackedSeries } from "./StackedConstants.js"
import { stackSeries, withMissingValuesAsZeroes } from "./StackedUtils.js"
import { makeClipPath } from "../chart/ChartUtils.js"
import { Time } from "../../clientUtils/owidTypes.js"

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    seriesArr: readonly StackedSeries<Time>[]
    focusedSeriesNames: SeriesName[]
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

    @computed private get areas(): JSX.Element[] {
        const { dualAxis, seriesArr } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        const xBottomLeft = [horizontalAxis.range[0], verticalAxis.range[0]]
        const xBottomRight = [horizontalAxis.range[1], verticalAxis.range[0]]

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        let prevPoints = [xBottomLeft, xBottomRight]
        return seriesArr.map((series) => {
            let mainPoints: [number, number][] = []
            if (series.points.length > 1) {
                mainPoints = series.points.map(
                    (point) =>
                        [
                            horizontalAxis.place(point.position),
                            verticalAxis.place(point.value + point.valueOffset),
                        ] as [number, number]
                )
            } else if (series.points.length === 1) {
                // We only have one point, so make it so it stretches out over the whole x axis range
                const point = series.points[0]
                const y = verticalAxis.place(point.value + point.valueOffset)
                mainPoints = [
                    [horizontalAxis.range[0], y],
                    [horizontalAxis.range[1], y],
                ]
            }
            const points = mainPoints.concat(reverse(clone(prevPoints)) as any)
            prevPoints = mainPoints

            return (
                <path
                    className={makeSafeForCSS(series.seriesName) + "-area"}
                    key={series.seriesName + "-area"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    fill={this.seriesIsBlur(series) ? BLUR_COLOR : series.color}
                    fillOpacity={0.7}
                    clipPath={this.props.clipPath}
                />
            )
        })
    }

    @computed private get borders(): JSX.Element[] {
        const { dualAxis, seriesArr } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        return seriesArr.map((series) => {
            const points = series.points.map(
                (point) =>
                    [
                        horizontalAxis.place(point.position),
                        verticalAxis.place(point.value + point.valueOffset),
                    ] as [number, number]
            )

            return (
                <path
                    className={makeSafeForCSS(series.seriesName) + "-border"}
                    key={series.seriesName + "-border"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    stroke={rgb(
                        this.seriesIsBlur(series) ? BLUR_COLOR : series.color
                    )
                        .darker(0.5)
                        .toString()}
                    strokeOpacity={0.7}
                    strokeWidth={0.5}
                    fill="none"
                    clipPath={this.props.clipPath}
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
            }))
            .reverse()
    }

    @computed get maxLineLegendWidth(): number {
        return Math.min(150, this.bounds.width / 3)
    }

    @computed get legendDimensions(): LineLegend | undefined {
        if (this.manager.hideLegend) return undefined
        return new LineLegend({ manager: this })
    }

    @observable hoveredPointIndex?: number

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
                ...this.series
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
        if (!this.base.current) return
        const { dualAxis, series } = this

        const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

        const boxPadding = isMobile() ? 44 : 25

        // expand the box width, so it's easier to see the tooltip for the first & last timepoints
        const boundedBox = this.dualAxis.innerBounds.expand({
            left: boxPadding,
            right: boxPadding,
        })

        if (boundedBox.contains(mouse)) {
            const closestPoint = minBy(series[0].points, (d) =>
                Math.abs(dualAxis.horizontalAxis.place(d.position) - mouse.x)
            )
            if (closestPoint) {
                const index = series[0].points.indexOf(closestPoint)
                this.hoveredPointIndex = index
            } else {
                this.hoveredPointIndex = undefined
            }
        } else {
            this.hoveredPointIndex = undefined
        }
    }

    @action.bound private onCursorLeave(): void {
        this.hoveredPointIndex = undefined
    }

    @computed private get activeXVerticalLine(): JSX.Element | undefined {
        const { dualAxis, series, hoveredPointIndex } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        if (hoveredPointIndex === undefined) return undefined

        return (
            <g className="hoverIndicator">
                {series.map((series) => {
                    const point = series.points[hoveredPointIndex]
                    return this.seriesIsBlur(series) || point.fake ? null : (
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
        if (this.hoveredPointIndex === undefined) return undefined

        const { hoveredPointIndex, dualAxis, series } = this

        // Grab the first value to get the year from
        const bottomSeriesPoint = series[0].points[hoveredPointIndex]

        // If some data is missing, don't calculate a total
        const somePointsMissingForHoveredTime = series.some(
            (series) => series.points[hoveredPointIndex].fake
        )

        const legendBlockStyle = {
            width: "10px",
            height: "10px",
            display: "inline-block",
            marginRight: "2px",
        }

        const lastStackedPoint = last(series)!.points[hoveredPointIndex]
        const totalValue = lastStackedPoint.value + lastStackedPoint.valueOffset

        const yColumn = this.yColumns[0] // Assumes same type for all columns.

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.props.manager}
                x={dualAxis.horizontalAxis.place(bottomSeriesPoint.position)}
                y={
                    dualAxis.verticalAxis.rangeMin +
                    dualAxis.verticalAxis.rangeSize / 2
                }
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table style={{ fontSize: "0.9em", lineHeight: "1.4em" }}>
                    <tbody>
                        <tr>
                            <td>
                                <strong>
                                    {this.inputTable.timeColumnFormatFunction(
                                        bottomSeriesPoint.position
                                    )}
                                </strong>
                            </td>
                            <td></td>
                        </tr>
                        {series
                            .slice()
                            .reverse()
                            .map((series) => {
                                const point = series.points[hoveredPointIndex]
                                const isBlur = this.seriesIsBlur(series)
                                const textColor = isBlur ? "#ddd" : "#333"
                                const blockColor = isBlur
                                    ? BLUR_COLOR
                                    : series.color
                                return (
                                    <tr
                                        key={series.seriesName}
                                        style={{ color: textColor }}
                                    >
                                        <td
                                            style={{
                                                paddingRight: "0.8em",
                                                fontSize: "0.9em",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    ...legendBlockStyle,
                                                    backgroundColor: blockColor,
                                                }}
                                            />{" "}
                                            {series.seriesName}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            {point.fake
                                                ? "No data"
                                                : yColumn.formatValueLong(
                                                      point.value
                                                  )}
                                        </td>
                                    </tr>
                                )
                            })}
                        {/* Total */}
                        {!somePointsMissingForHoveredTime && (
                            <tr>
                                <td style={{ fontSize: "0.9em" }}>
                                    <div
                                        style={{
                                            ...legendBlockStyle,
                                            backgroundColor: "transparent",
                                        }}
                                    />{" "}
                                    <strong>Total</strong>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    <span>
                                        <strong>
                                            {yColumn.formatValueLong(
                                                totalValue
                                            )}
                                        </strong>
                                    </span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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

        const { bounds, dualAxis, renderUid, series } = this

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
                <rect {...this.bounds.toProps()} fill="transparent">
                    {/* This <rect> ensures that the parent <g> is big enough such that we get mouse hover events for the
                    whole charting area, including the axis, the entity labels, and the whitespace next to them.
                    We need these to be able to show the tooltip for the first/last year even if the mouse is outside the charting area. */}
                </rect>
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={true} />
                <g clipPath={clipPath.id}>
                    {showLegend && <LineLegend manager={this} />}
                    <Areas
                        dualAxis={dualAxis}
                        seriesArr={series}
                        focusedSeriesNames={this.focusedSeriesNames}
                    />
                </g>
                {this.activeXVerticalLine}
                {this.tooltip}
            </g>
        )
    }
    /** Whether we want to display series with only zeroes (inherited). False for this class, true for others */
    get showAllZeroSeries() {
        return false
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
