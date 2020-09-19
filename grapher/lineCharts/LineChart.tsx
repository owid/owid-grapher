import * as React from "react"
import {
    sortBy,
    sum,
    guid,
    getRelativeMouse,
    makeSafeForCSS,
    pointsToPath,
    minBy,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"

import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "grapher/axis/Axis"
import { Vector2 } from "grapher/utils/Vector2"
import { LineLabelsHelper, LineLabelsComponent } from "./LineLabels"
import { ComparisonLine } from "grapher/scatterCharts/ComparisonLine"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { extent } from "d3-array"
import { LineChartTransform } from "./LineChartTransform"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { EntityName } from "owidTable/OwidTableConstants"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"

export interface LineChartValue {
    x: number
    y: number
    time: number
}

export interface LineChartSeries {
    entityName: string
    color: string
    values: LineChartValue[]
    classed?: string
    isProjection?: boolean
}

const BLUR_COLOR = "#eee"

interface LinesProps {
    dualAxis: DualAxis
    xAxis: HorizontalAxis
    yAxis: VerticalAxis
    data: LineChartSeries[]
    focusKeys: EntityName[]
    onHover: (hoverX: number | undefined) => void
}

interface LineRenderSeries {
    entityName: string
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
    @observable.ref private hover: HoverTarget | null = null

    @computed private get renderData(): LineRenderSeries[] {
        const { data, xAxis, yAxis, focusKeys } = this.props
        return data.map((series) => ({
            entityName: series.entityName,
            displayKey: `key-${makeSafeForCSS(series.entityName)}`,
            color: series.color,
            values: series.values.map((v) => {
                return new Vector2(
                    Math.round(xAxis.place(v.x)),
                    Math.round(yAxis.place(v.y))
                )
            }),
            isFocus: !focusKeys.length || focusKeys.includes(series.entityName),
            isProjection: series.isProjection,
        }))
    }

    @computed private get isFocusMode(): boolean {
        return this.renderData.some((d) => d.isFocus)
    }

    @computed private get allValues(): LineChartValue[] {
        const values = []
        for (const series of this.props.data) {
            values.push(...series.values)
        }
        return values
    }

    @action.bound private onCursorMove(ev: MouseEvent | TouchEvent) {
        const { dualAxis, xAxis } = this.props

        const mouse = getRelativeMouse(this.base.current, ev)

        let hoverX
        if (dualAxis.innerBounds.contains(mouse)) {
            const closestValue = minBy(this.allValues, (d) =>
                Math.abs(xAxis.place(d.x) - mouse.x)
            )
            hoverX = closestValue?.x
        }

        this.props.onHover(hoverX)
    }

    @action.bound private onCursorLeave() {
        this.props.onHover(undefined)
    }

    @computed get bounds() {
        const { xAxis, yAxis } = this.props
        return Bounds.fromCorners(
            new Vector2(xAxis.range[0], yAxis.range[0]),
            new Vector2(xAxis.range[1], yAxis.range[1])
        )
    }

    @computed private get focusGroups() {
        return this.renderData.filter((g) => g.isFocus)
    }

    @computed private get backgroundGroups() {
        return this.renderData.filter((g) => !g.isFocus)
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed private get hasMarkers(): boolean {
        return sum(this.renderData.map((g) => g.values.length)) < 500
    }

    private renderFocusGroups() {
        return this.focusGroups.map((series) => (
            <g key={series.displayKey} className={series.displayKey}>
                <path
                    stroke={series.color}
                    strokeLinecap="round"
                    d={pointsToPath(
                        series.values.map((v) => [v.x, v.y]) as [
                            number,
                            number
                        ][]
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

    private renderBackgroundGroups() {
        return this.backgroundGroups.map((series) => (
            <g key={series.displayKey} className={series.displayKey}>
                <path
                    key={series.entityName + "-line"}
                    strokeLinecap="round"
                    stroke="#ddd"
                    d={pointsToPath(
                        series.values.map((v) => [v.x, v.y]) as [
                            number,
                            number
                        ][]
                    )}
                    fill="none"
                    strokeWidth={1}
                />
            </g>
        ))
    }

    private container?: SVGElement
    componentDidMount() {
        const base = this.base.current as SVGGElement
        const container = base.closest("svg") as SVGElement
        container.addEventListener("mousemove", this.onCursorMove)
        container.addEventListener("mouseleave", this.onCursorLeave)
        container.addEventListener("touchstart", this.onCursorMove)
        container.addEventListener("touchmove", this.onCursorMove)
        container.addEventListener("touchend", this.onCursorLeave)
        container.addEventListener("touchcancel", this.onCursorLeave)
        this.container = container
    }

    componentWillUnmount() {
        const { container } = this
        if (container) {
            container.removeEventListener("mousemove", this.onCursorMove)
            container.removeEventListener("mouseleave", this.onCursorLeave)
            container.removeEventListener("touchstart", this.onCursorMove)
            container.removeEventListener("touchmove", this.onCursorMove)
            container.removeEventListener("touchend", this.onCursorLeave)
            container.removeEventListener("touchcancel", this.onCursorLeave)
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

interface LineChartOptionsProvider extends ChartOptionsProvider {
    lineChartTransform: LineChartTransform
}

@observer
export class LineChart extends React.Component<{
    bounds?: Bounds
    options: LineChartOptionsProvider
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable hoverX?: number
    @action.bound onHover(hoverX: number | undefined) {
        this.hoverX = hoverX
    }

    @computed private get options() {
        return this.props.options
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get transform() {
        return this.options.lineChartTransform
    }

    @computed get legend(): LineLabelsHelper | undefined {
        const that = this
        return new LineLabelsHelper({
            get maxWidth() {
                return that.bounds.width / 3
            },
            get fontSize() {
                return that.options.baseFontSize ?? BASE_FONT_SIZE
            },
            get items() {
                return that.transform.legendItems
            },
        })
    }

    seriesIsBlur(series: LineChartSeries) {
        return this.isFocusMode && !this.focusKeys.includes(series.entityName)
    }

    @computed private get tooltip(): JSX.Element | undefined {
        const { transform, hoverX, dualAxis } = this

        if (hoverX === undefined) return undefined

        const sortedData = sortBy(transform.groupedData, (series) => {
            const value = series.values.find((v) => v.x === hoverX)
            return value !== undefined ? -value.y : Infinity
        })

        const formatted = this.transform.grapher.table.timeColumnFormatFunction(
            hoverX
        )

        return (
            <Tooltip
                tooltipProvider={this.options}
                x={dualAxis.horizontalAxis.place(hoverX)}
                y={
                    dualAxis.verticalAxis.rangeMin +
                    dualAxis.verticalAxis.rangeSize / 2
                }
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table
                    style={{
                        fontSize: "0.9em",
                        lineHeight: "1.4em",
                        whiteSpace: "normal",
                    }}
                >
                    <tbody>
                        <tr>
                            <td colSpan={3}>
                                <strong>{formatted}</strong>
                            </td>
                        </tr>
                        {sortedData.map((series) => {
                            const value = series.values.find(
                                (v) => v.x === hoverX
                            )

                            const annotation = this.transform.getAnnotationsForSeries(
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
                                    (v) => v.x
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
                                    key={series.entityName}
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
                                                marginRight: "2px",
                                            }}
                                        />
                                    </td>
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em",
                                        }}
                                    >
                                        {this.options.table.getLabelForEntityName(
                                            series.entityName
                                        )}
                                        {annotation && (
                                            <span
                                                className="tooltipAnnotation"
                                                style={{
                                                    color: annotationColor,
                                                    fontSize: "90%",
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
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {!value
                                            ? "No data"
                                            : transform.verticalAxis.formatTick(
                                                  value.y
                                                  //  ,{ noTrailingZeroes: false } // todo: add back?
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

    // todo: Refactor
    @computed private get dualAxis() {
        const { horizontalAxis, verticalAxis } = this.transform
        return new DualAxis({
            bounds: this.bounds.padRight(this.legend ? this.legend.width : 20),
            verticalAxis,
            horizontalAxis,
        })
    }

    @observable hoverKey?: string
    @action.bound onLegendClick() {
        if (this.options.showAddEntityControls)
            this.options.isSelectingData = true
    }

    @action.bound onLegendMouseOver(key: EntityName) {
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
                    options={this.options}
                    bounds={this.props.bounds}
                    message={this.transform.failMessage}
                />
            )

        const {
            options,
            transform,
            bounds,
            legend,
            tooltip,
            dualAxis,
            renderUid,
            hoverX,
        } = this
        const { horizontalAxis, verticalAxis } = dualAxis
        const { groupedData } = transform

        const comparisonLines = options.comparisonLines || []

        return (
            <g ref={this.base} className="LineChart">
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        {/* The tiny bit of extra space here is to ensure circles centered on the very edge are still fully visible */}
                        <rect
                            x={dualAxis.innerBounds.x - 10}
                            y={0}
                            width={bounds.width + 10}
                            height={bounds.height * 2}
                        ></rect>
                    </clipPath>
                </defs>
                <DualAxisComponent
                    isInteractive={this.transform.grapher.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                    {legend && (
                        <LineLabelsComponent
                            x={bounds.right - legend.width}
                            legend={legend}
                            focusKeys={this.focusKeys}
                            yAxis={dualAxis.verticalAxis}
                            onClick={this.onLegendClick}
                            options={options}
                            onMouseOver={this.onLegendMouseOver}
                            onMouseLeave={this.onLegendMouseLeave}
                        />
                    )}
                    <Lines
                        dualAxis={dualAxis}
                        xAxis={dualAxis.horizontalAxis}
                        yAxis={dualAxis.verticalAxis}
                        data={groupedData}
                        onHover={this.onHover}
                        focusKeys={this.focusKeys}
                    />
                </g>
                {hoverX !== undefined && (
                    <g className="hoverIndicator">
                        {transform.groupedData.map((series) => {
                            const value = series.values.find(
                                (v) => v.x === hoverX
                            )
                            if (!value || this.seriesIsBlur(series)) return null
                            else
                                return (
                                    <circle
                                        key={series.entityName}
                                        cx={horizontalAxis.place(value.x)}
                                        cy={verticalAxis.place(value.y)}
                                        r={4}
                                        fill={series.color}
                                    />
                                )
                        })}
                        <line
                            x1={horizontalAxis.place(hoverX)}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(hoverX)}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}

                {tooltip}
            </g>
        )
    }
}
