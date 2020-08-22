/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from "react"
import {
    last,
    map,
    flatten,
    some,
    includes,
    sortBy,
    filter,
    sum,
    guid,
    getRelativeMouse,
    makeSafeForCSS,
    pointsToPath,
    minBy
} from "../utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"

import { ChartConfig } from "charts/core/ChartConfig"
import { Bounds } from "charts/utils/Bounds"
import { AxisBox } from "charts/axis/AxisBox"
import { AxisScale } from "charts/axis/AxisScale"
import { StandardAxisBoxView } from "charts/axis/StandardAxisBoxView"
import { Vector2 } from "charts/utils/Vector2"
import {
    HeightedLegend,
    HeightedLegendItem,
    HeightedLegendComponent
} from "./HeightedLegend"
import { ComparisonLine } from "../scatterCharts/ComparisonLine"
import { Tooltip } from "charts/core/Tooltip"
import { NoDataOverlay } from "../core/NoDataOverlay"
import {
    ChartViewContext,
    ChartViewContextType
} from "charts/core/ChartViewContext"
import { extent } from "d3-array"
import { EntityDimensionKey } from "charts/core/ChartConstants"
import { entityName } from "owidTable/OwidTable"

export interface LineChartValue {
    x: number
    y: number
    time: number
}

export interface LineChartSeries {
    entityDimensionKey: EntityDimensionKey
    entityName: string
    color: string
    values: LineChartValue[]
    classed?: string
    isProjection?: boolean
    formatValue: (value: number) => string
}

const BLUR_COLOR = "#eee"

interface LinesProps {
    axisBox: AxisBox
    xScale: AxisScale
    yScale: AxisScale
    data: LineChartSeries[]
    focusKeys: EntityDimensionKey[]
    onHover: (hoverX: number | undefined) => void
}

interface LineRenderSeries {
    entityDimensionKey: EntityDimensionKey
    displayKey: string
    color: string
    values: Vector2[]
    isFocus: boolean
    isProjection?: boolean
}

interface HoverTarget {
    pos: Vector2
    series: LineChartSeries
    value: LineChartValue
}

@observer
class Lines extends React.Component<LinesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @observable.ref hover: HoverTarget | null = null

    @computed get renderUid(): number {
        return guid()
    }

    @computed get renderData(): LineRenderSeries[] {
        const { data, xScale, yScale, focusKeys } = this.props
        return map(data, series => {
            return {
                entityDimensionKey: series.entityDimensionKey,
                displayKey: `key-${makeSafeForCSS(series.entityDimensionKey)}`,
                color: series.color,
                values: series.values.map(v => {
                    return new Vector2(
                        Math.round(xScale.place(v.x)),
                        Math.round(yScale.place(v.y))
                    )
                }),
                isFocus:
                    !focusKeys.length ||
                    includes(focusKeys, series.entityDimensionKey),
                isProjection: series.isProjection
            }
        })
    }

    @computed get isFocusMode(): boolean {
        return some(this.renderData, d => d.isFocus)
    }

    @computed get allValues(): LineChartValue[] {
        const values = []
        for (const series of this.props.data) {
            values.push(...series.values)
        }
        return values
    }

    @computed get hoverData(): HoverTarget[] {
        const { data } = this.props
        return flatten(
            this.renderData.map((series, i) => {
                return series.values.map((v, j) => {
                    return {
                        pos: v,
                        series: data[i],
                        value: data[i].values[j]
                    }
                })
            })
        )
    }

    @action.bound onCursorMove(ev: MouseEvent | TouchEvent) {
        const { axisBox, xScale } = this.props

        const mouse = getRelativeMouse(this.base.current, ev)

        let hoverX
        if (axisBox.innerBounds.contains(mouse)) {
            const closestValue = minBy(this.allValues, d =>
                Math.abs(xScale.place(d.x) - mouse.x)
            )
            hoverX = closestValue?.x
        }

        this.props.onHover(hoverX)
    }

    @action.bound onCursorLeave(ev: MouseEvent | TouchEvent) {
        this.props.onHover(undefined)
    }

    @computed get bounds() {
        const { xScale, yScale } = this.props
        return Bounds.fromCorners(
            new Vector2(xScale.range[0], yScale.range[0]),
            new Vector2(xScale.range[1], yScale.range[1])
        )
    }

    @computed get focusGroups() {
        return filter(this.renderData, g => g.isFocus)
    }

    @computed get backgroundGroups() {
        return filter(this.renderData, g => !g.isFocus)
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed get hasMarkers(): boolean {
        return sum(this.renderData.map(g => g.values.length)) < 500
    }

    renderFocusGroups() {
        return this.focusGroups.map(series => (
            <g key={series.displayKey} className={series.displayKey}>
                <path
                    stroke={series.color}
                    strokeLinecap="round"
                    d={pointsToPath(
                        series.values.map(v => [v.x, v.y]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray={series.isProjection ? "1,4" : undefined}
                />
                {this.hasMarkers && !series.isProjection && (
                    <g fill={series.color}>
                        {series.values.map((v, i) => (
                            <circle key={i} cx={v.x} cy={v.y} r={2} />
                        ))}
                    </g>
                )}
            </g>
        ))
    }

    renderBackgroundGroups() {
        return this.backgroundGroups.map(series => (
            <g key={series.displayKey} className={series.displayKey}>
                <path
                    key={series.entityDimensionKey + "-line"}
                    strokeLinecap="round"
                    stroke="#ddd"
                    d={pointsToPath(
                        series.values.map(v => [v.x, v.y]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={1}
                />
            </g>
        ))
    }

    container?: SVGElement
    componentDidMount() {
        const base = this.base.current as SVGGElement
        this.container = base.closest("svg") as SVGElement

        this.container.addEventListener("mousemove", this.onCursorMove)
        this.container.addEventListener("mouseleave", this.onCursorLeave)
        this.container.addEventListener("touchstart", this.onCursorMove)
        this.container.addEventListener("touchmove", this.onCursorMove)
        this.container.addEventListener("touchend", this.onCursorLeave)
        this.container.addEventListener("touchcancel", this.onCursorLeave)
    }

    componentWillUnmount() {
        if (this.container) {
            this.container.removeEventListener("mousemove", this.onCursorMove)
            this.container.removeEventListener("mouseleave", this.onCursorLeave)
            this.container.removeEventListener("touchstart", this.onCursorMove)
            this.container.removeEventListener("touchmove", this.onCursorMove)
            this.container.removeEventListener("touchend", this.onCursorLeave)
            this.container.removeEventListener(
                "touchcancel",
                this.onCursorLeave
            )
        }
    }

    render() {
        const { hover, bounds } = this

        return (
            <g ref={this.base} className="Lines">
                <rect
                    x={Math.round(bounds.x)}
                    y={Math.round(bounds.y)}
                    width={Math.round(bounds.width)}
                    height={Math.round(bounds.height)}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {this.renderBackgroundGroups()}
                {this.renderFocusGroups()}
                {hover && (
                    <circle
                        cx={hover.pos.x}
                        cy={hover.pos.y}
                        r={5}
                        fill={hover.series.color}
                    />
                )}
            </g>
        )
    }
}

@observer
export class LineChart extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    static contextType = ChartViewContext
    context!: ChartViewContextType

    @observable hoverX?: number
    @action.bound onHover(hoverX: number | undefined) {
        this.hoverX = hoverX
    }

    @computed get chart() {
        return this.props.chart
    }
    @computed get bounds() {
        return this.props.bounds
    }
    @computed get transform() {
        return this.props.chart.lineChart
    }

    @computed get annotationsMap() {
        return this.props.chart.primaryDimensions[0].column.annotationsColumn
            ?.entityNameMap
    }

    getAnnotationsForSeries(entityName: entityName) {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(entityName)
        return annos ? Array.from(annos.values()).join(" & ") : undefined
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed private get legendItems(): HeightedLegendItem[] {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let toShow = this.transform.groupedData
        if (toShow.some(g => !!g.isProjection))
            toShow = this.transform.groupedData.filter(g => g.isProjection)

        return toShow.map(series => {
            const lastValue = (last(series.values) as LineChartValue).y
            return {
                color: series.color,
                entityDimensionKey: series.entityDimensionKey,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.chart.hideLegend
                    ? ""
                    : `${this.chart.data.getLabelForKey(
                          series.entityDimensionKey
                      )}`, //this.chart.hideLegend ? valueStr : `${valueStr} ${this.chart.data.formatKey(d.key)}`,
                annotation: this.getAnnotationsForSeries(series.entityName),
                yValue: lastValue
            }
        })
    }

    @computed get legend(): HeightedLegend | undefined {
        const that = this
        return new HeightedLegend({
            get maxWidth() {
                return that.bounds.width / 3
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get items() {
                return that.legendItems
            }
        })
    }

    seriesIsBlur(series: LineChartSeries) {
        return (
            this.isFocusMode &&
            !this.focusKeys.includes(series.entityDimensionKey)
        )
    }

    @computed get tooltip(): JSX.Element | undefined {
        const { transform, hoverX, axisBox, chart } = this

        if (hoverX === undefined) return undefined

        const sortedData = sortBy(transform.groupedData, series => {
            const value = series.values.find(v => v.x === hoverX)
            return value !== undefined ? -value.y : Infinity
        })

        return (
            <Tooltip
                x={axisBox.xScale.place(hoverX)}
                y={axisBox.yScale.rangeMin + axisBox.yScale.rangeSize / 2}
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table
                    style={{
                        fontSize: "0.9em",
                        lineHeight: "1.4em",
                        whiteSpace: "normal"
                    }}
                >
                    <tbody>
                        <tr>
                            <td colSpan={3}>
                                <strong>
                                    {this.chart.formatYearFunction(hoverX)}
                                </strong>
                            </td>
                        </tr>
                        {sortedData.map(series => {
                            const value = series.values.find(
                                v => v.x === hoverX
                            )

                            const annotation = this.getAnnotationsForSeries(
                                series.entityName
                            )

                            // It sometimes happens that data is missing for some years for a particular
                            // entity. If the user hovers over these years, we want to show a "No data"
                            // notice. However, we only want to show this notice when we are in the middle
                            // of a time series – when data points exist before and after the current year.
                            // Otherwise we want to entirely exclude the entity from the tooltip.
                            if (!value) {
                                const [startX, endX] = extent(
                                    series.values,
                                    v => v.x
                                )
                                if (
                                    startX === undefined ||
                                    endX === undefined ||
                                    startX > hoverX ||
                                    endX < hoverX
                                ) {
                                    return undefined
                                }
                            }

                            const isBlur =
                                this.seriesIsBlur(series) || value === undefined
                            const textColor = isBlur ? "#ddd" : "#333"
                            const annotationColor = isBlur ? "#ddd" : "#999"
                            const circleColor = isBlur
                                ? BLUR_COLOR
                                : series.color
                            return (
                                <tr
                                    key={series.entityDimensionKey}
                                    style={{ color: textColor }}
                                >
                                    <td>
                                        <div
                                            style={{
                                                width: "10px",
                                                height: "10px",
                                                borderRadius: "5px",
                                                backgroundColor: circleColor,
                                                display: "inline-block",
                                                marginRight: "2px"
                                            }}
                                        />
                                    </td>
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em"
                                        }}
                                    >
                                        {chart.data.getLabelForKey(
                                            series.entityDimensionKey
                                        )}
                                        {annotation && (
                                            <span
                                                className="tooltipAnnotation"
                                                style={{
                                                    color: annotationColor,
                                                    fontSize: "90%"
                                                }}
                                            >
                                                {" "}
                                                {annotation}
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        {!value
                                            ? "No data"
                                            : transform.yAxis.tickFormat(
                                                  value.y,
                                                  { noTrailingZeroes: false }
                                              )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Tooltip>
        )
    }

    @computed get axisBox() {
        const that = this
        return new AxisBox({
            get bounds() {
                return that.bounds.padRight(
                    that.legend ? that.legend.width : 20
                )
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get yAxis() {
                return that.transform.yAxis
            },
            get xAxis() {
                return that.transform.xAxis
            }
        })
    }

    @observable hoverKey?: string
    @action.bound onLegendClick(key: EntityDimensionKey) {
        if (this.chart.showAddEntityControls) {
            this.context.chartView.isSelectingData = true
        }
    }

    @action.bound onLegendMouseOver(key: EntityDimensionKey) {
        this.hoverKey = key
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    @computed get focusKeys(): string[] {
        return this.hoverKey ? [this.hoverKey] : []
    }

    @computed get isFocusMode(): boolean {
        return this.focusKeys.length > 0
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount() {
        // Fancy intro animation

        const base = select(this.base.current)
        this.animSelection = base.selectAll("clipPath > rect").attr("width", 0)

        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid(): number {
        return guid()
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoDataOverlay
                    bounds={this.props.bounds}
                    message={this.transform.failMessage}
                />
            )

        const {
            chart,
            transform,
            bounds,
            legend,
            tooltip,
            axisBox,
            renderUid,
            hoverX
        } = this
        const { xScale, yScale } = axisBox
        const { groupedData } = transform

        return (
            <g ref={this.base} className="LineChart">
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        {/* The tiny bit of extra space here is to ensure circles centered on the very edge are still fully visible */}
                        <rect
                            x={axisBox.innerBounds.x - 10}
                            y={0}
                            width={bounds.width + 10}
                            height={bounds.height * 2}
                        ></rect>
                    </clipPath>
                </defs>
                <StandardAxisBoxView axisBox={axisBox} chart={chart} />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {chart.comparisonLines &&
                        chart.comparisonLines.map((line, i) => (
                            <ComparisonLine
                                key={i}
                                axisBox={axisBox}
                                comparisonLine={line}
                            />
                        ))}
                    {legend && (
                        <HeightedLegendComponent
                            x={bounds.right - legend.width}
                            legend={legend}
                            focusKeys={this.focusKeys}
                            yScale={axisBox.yScale}
                            onClick={this.onLegendClick}
                            areMarksClickable={this.chart.showAddEntityControls}
                            onMouseOver={this.onLegendMouseOver}
                            onMouseLeave={this.onLegendMouseLeave}
                        />
                    )}
                    <Lines
                        axisBox={axisBox}
                        xScale={axisBox.xScale}
                        yScale={axisBox.yScale}
                        data={groupedData}
                        onHover={this.onHover}
                        focusKeys={this.focusKeys}
                    />
                </g>
                {hoverX !== undefined && (
                    <g className="hoverIndicator">
                        {transform.groupedData.map(series => {
                            const value = series.values.find(
                                v => v.x === hoverX
                            )
                            if (!value || this.seriesIsBlur(series)) return null
                            else
                                return (
                                    <circle
                                        key={series.entityDimensionKey}
                                        cx={xScale.place(value.x)}
                                        cy={yScale.place(value.y)}
                                        r={4}
                                        fill={series.color}
                                    />
                                )
                        })}
                        <line
                            x1={xScale.place(hoverX)}
                            y1={yScale.range[0]}
                            x2={xScale.place(hoverX)}
                            y2={yScale.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}

                {tooltip}
            </g>
        )
    }
}
