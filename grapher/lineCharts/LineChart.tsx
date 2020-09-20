import * as React from "react"
import {
    sortBy,
    sum,
    guid,
    getRelativeMouse,
    makeSafeForCSS,
    pointsToPath,
    minBy,
    flatten,
    last,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "grapher/axis/Axis"
import { Vector2 } from "grapher/utils/Vector2"
import {
    LineLegend,
    LineLabel,
    LineLegendOptionsProvider,
} from "grapher/lineLegend/LineLegend"
import { ComparisonLine } from "grapher/scatterCharts/ComparisonLine"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { extent } from "d3-array"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { EntityName } from "owidTable/OwidTableConstants"
import { BASE_FONT_SIZE, ScaleType, Range } from "grapher/core/GrapherConstants"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"

interface LineChartValue {
    x: number
    y: number
    time: number
}

interface LineChartSeries {
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

    @computed private get isFocusMode() {
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
        if (!container) return

        container.removeEventListener("mousemove", this.onCursorMove)
        container.removeEventListener("mouseleave", this.onCursorLeave)
        container.removeEventListener("touchstart", this.onCursorMove)
        container.removeEventListener("touchmove", this.onCursorMove)
        container.removeEventListener("touchend", this.onCursorLeave)
        container.removeEventListener("touchcancel", this.onCursorLeave)
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
export class LineChart
    extends React.Component<{
        bounds?: Bounds
        options: ChartOptionsProvider
    }>
    implements ChartInterface, LineLegendOptionsProvider {
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

    @computed get maxLegendWidth() {
        return this.bounds.width / 3
    }

    seriesIsBlur(series: LineChartSeries) {
        return this.isFocusMode && !this.focusKeys.includes(series.entityName)
    }

    @computed private get tooltip() {
        const { hoverX, dualAxis } = this

        if (hoverX === undefined) return undefined

        const sortedData = sortBy(this.marks, (series) => {
            const value = series.values.find((v) => v.x === hoverX)
            return value !== undefined ? -value.y : Infinity
        })

        const formatted = this.options.table.timeColumnFormatFunction(hoverX)

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
                                            : this.verticalAxis.formatTick(
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
        const { horizontalAxis, verticalAxis } = this
        return new DualAxis({
            bounds: this.bounds.padRight(
                this.legendDimensions ? this.legendDimensions.width : 20
            ),
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

    @computed get focusKeys() {
        return this.hoverKey ? [this.hoverKey] : []
    }

    @computed get isFocusMode() {
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

    @computed get renderUid() {
        return guid()
    }

    @computed get fontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendX(): number {
        return this.bounds.right - this.legendDimensions.width
    }

    @computed private get legendDimensions() {
        return new LineLegend({ options: this })
    }

    render() {
        if (this.failMessage) {
            console.log(this.failMessage)
            return (
                <NoDataOverlay
                    options={this.options}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )
        }

        const { options, bounds, tooltip, dualAxis, renderUid, hoverX } = this
        const { horizontalAxis, verticalAxis } = dualAxis
        const { marks } = this

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
                    isInteractive={this.options.isInteractive}
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
                    <LineLegend options={this} />
                    <Lines
                        dualAxis={dualAxis}
                        xAxis={dualAxis.horizontalAxis}
                        yAxis={dualAxis.verticalAxis}
                        data={marks}
                        onHover={this.onHover}
                        focusKeys={this.focusKeys}
                    />
                </g>
                {hoverX !== undefined && (
                    <g className="hoverIndicator">
                        {this.marks.map((series) => {
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

    @computed get failMessage() {
        const { yColumns } = this.options
        if (!yColumns?.length) return "Missing Y axis column"
        else if (!this.marks.length) return "No matching data"
        return ""
    }

    @computed private get yColumn() {
        return this.options.yColumns![0]!
    }

    @computed private get annotationsMap() {
        return this.yColumn.annotationsColumn?.entityNameMap
    }

    @computed private get colorScheme() {
        const colorScheme = ColorSchemes[this.options.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["owid-distinct"] as ColorScheme)
    }

    @computed get marks() {
        const { yColumns, yAxis, table } = this.options
        if (!yColumns) return []

        const { selectedEntityNames } = table

        const isLog = yAxis?.scaleType === ScaleType.log

        let chartData: LineChartSeries[] = flatten(
            yColumns.map((column) => {
                const seriesByKey = new Map<EntityName, LineChartSeries>()
                const { isProjection } = column

                column.owidRows
                    .filter((row) => !isLog || row.value > 0)
                    .filter((row) =>
                        selectedEntityNames.includes(row.entityName)
                    )
                    .forEach((row) => {
                        const { time, entityName, value } = row

                        if (!seriesByKey.has(entityName))
                            seriesByKey.set(entityName, {
                                values: [],
                                entityName,
                                isProjection,
                                color: "#000", // tmp
                            })

                        seriesByKey
                            .get(entityName)!
                            .values.push({ x: time, y: value, time })
                    })

                return Array.from(seriesByKey.values())
            })
        )

        this._addColorsToSeries(chartData)

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, (series) =>
            selectedEntityNames.indexOf(series.entityName)
        )

        return chartData

        // // Filter the data so it fits within the domains

        // const { horizontalAxis } = this

        // for (const g of chartData) {
        //     // The values can include non-numerical values, so we need to filter with isNaN()
        //     g.values = g.values.filter(
        //         (d) =>
        //             d.x >= horizontalAxis.domain[0] &&
        //             d.x <= horizontalAxis.domain[1] &&
        //             !isNaN(d.y)
        //     )
        // }

        // return chartData.filter((g) => g.values.length > 0)
    }

    private _addColorsToSeries(allSeries: LineChartSeries[]) {
        // Color from lowest to highest
        const sorted = sortBy(allSeries, (series) => last(series.values)!.y)

        const colors = this.colorScheme.getColors(sorted.length)
        if (this.options.invertColorScheme) colors.reverse()

        const table = this.options.table

        sorted.forEach((series, i) => {
            series.color =
                table.getColorForEntityName(series.entityName) || colors[i]
        })
    }

    // @computed get predomainData() {
    //     if (!this.options.isRelativeMode) return this.initialData

    //     return cloneDeep(this.initialData).map((series) => {
    //         const startIndex = series.values.findIndex(
    //             (value) => value.time >= this.startTimelineTime && value.y !== 0
    //         )
    //         if (startIndex < 0) {
    //             series.values = []
    //             return series
    //         }

    //         const relativeValues = series.values.slice(startIndex)
    //         // Clone to avoid overwriting in next loop
    //         const indexValue = clone(relativeValues[0])
    //         series.values = relativeValues.map((value) => {
    //             value.y = (value.y - indexValue.y) / Math.abs(indexValue.y)
    //             return value
    //         })

    //         return series
    //     })
    // }

    getAnnotationsForSeries(entityName: EntityName) {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(entityName)
        return annos ? Array.from(annos.values()).join(" & ") : undefined
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get legendItems(): LineLabel[] {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let toShow = this.marks
        if (toShow.some((g) => !!g.isProjection))
            toShow = toShow.filter((g) => g.isProjection)

        return toShow.map((series) => {
            const lastValue = last(series.values)!.y
            return {
                color: series.color,
                entityName: series.entityName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.options.hideLegend
                    ? ""
                    : `${this.options.table.getLabelForEntityName(
                          series.entityName
                      )}`,
                annotation: this.getAnnotationsForSeries(series.entityName),
                yValue: lastValue,
            }
        })
    }

    @computed get xAxis() {
        return this.options.xAxis ?? new AxisConfig()
    }

    @computed get yAxis() {
        return this.options.yAxis ?? new AxisConfig()
    }

    @computed get horizontalAxis() {
        const axis = this.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([
            this.yColumn.startTimelineTime,
            this.yColumn.endTimelineTime,
        ])
        axis.scaleType = ScaleType.linear
        axis.scaleTypeOptions = [ScaleType.linear]
        axis.column = this.options.table.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yDomain(): Range {
        const yDomain = this.yColumn.domain
        const domain = this.yAxis.domain
        return [
            Math.min(domain[0], yDomain[0]),
            Math.max(domain[1], yDomain[1]),
        ]
    }

    @computed get verticalAxis() {
        const { options, yDomain } = this
        const axis = this.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomain)
        if (options.isRelativeMode) axis.scaleTypeOptions = [ScaleType.linear]
        axis.hideFractionalTicks = this.yColumn.isAllIntegers // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.column = this.yColumn
        return axis
    }
}
