import * as React from "react"
import {
    reverse,
    clone,
    last,
    guid,
    pointsToPath,
    getRelativeMouse,
    makeSafeForCSS,
    minBy,
    flatten,
    max,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { scaleOrdinal } from "d3-scale"
import { Time, BASE_FONT_SIZE } from "grapher/core/GrapherConstants"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import {
    LineLabelMark,
    LineLegend,
    LineLegendManager,
} from "grapher/lineLegend/LineLegend"
import { NoDataModal } from "grapher/chart/NoDataModal"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { rgb } from "d3-color"
import { ChartManager } from "grapher/chart/ChartManager"
import { EntityName } from "coreTable/CoreTableConstants"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { AreasProps, StackedAreaSeries } from "./StackedAreaChartConstants"
import { stackAreas } from "./StackedAreaChartUtils"

const BLUR_COLOR = "#ddd"

@observer
class Areas extends React.Component<AreasProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable hoverIndex?: number

    @action.bound private onCursorMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ) {
        const { dualAxis, seriesArr } = this.props

        const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

        if (dualAxis.innerBounds.contains(mouse)) {
            const closestPoint = minBy(seriesArr[0].points, (d) =>
                Math.abs(dualAxis.horizontalAxis.place(d.x) - mouse.x)
            )
            if (closestPoint) {
                const index = seriesArr[0].points.indexOf(closestPoint)
                this.hoverIndex = index
            } else {
                this.hoverIndex = undefined
            }
        } else {
            this.hoverIndex = undefined
        }

        this.props.onHover(this.hoverIndex)
    }

    @action.bound private onCursorLeave() {
        this.hoverIndex = undefined
        this.props.onHover(this.hoverIndex)
    }

    private seriesIsBlur(series: StackedAreaSeries) {
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
            const mainPoints = series.points.map(
                (v) =>
                    [horizontalAxis.place(v.x), verticalAxis.place(v.y)] as [
                        number,
                        number
                    ]
            )
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
                (v) =>
                    [horizontalAxis.place(v.x), verticalAxis.place(v.y)] as [
                        number,
                        number
                    ]
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

    render() {
        const { dualAxis, seriesArr } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        const { hoverIndex } = this

        return (
            <g
                ref={this.base}
                className="Areas"
                onMouseMove={this.onCursorMove}
                onMouseLeave={this.onCursorLeave}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
            >
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
                {hoverIndex !== undefined && (
                    <g className="hoverIndicator">
                        {seriesArr.map((series) => {
                            return this.seriesIsBlur(series) ? null : (
                                <circle
                                    key={series.seriesName}
                                    cx={horizontalAxis.place(
                                        series.points[hoverIndex].x
                                    )}
                                    cy={verticalAxis.place(
                                        series.points[hoverIndex].y
                                    )}
                                    r={2}
                                    fill={series.color}
                                />
                            )
                        })}
                        <line
                            x1={horizontalAxis.place(
                                seriesArr[0].points[hoverIndex].x
                            )}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(
                                seriesArr[0].points[hoverIndex].x
                            )}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}
            </g>
        )
    }
}

@observer
export class StackedAreaChart
    extends React.Component<{
        bounds?: Bounds
        manager: ChartManager
    }>
    implements ChartInterface, LineLegendManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get manager() {
        return this.props.manager
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get midpoints() {
        let prevY = 0
        return this.marks.map((series) => {
            const lastValue = last(series.points)
            if (lastValue) {
                const middleY = prevY + (lastValue.y - prevY) / 2
                prevY = lastValue.y
                return middleY
            } else return 0
        })
    }

    @computed get labelMarks(): LineLabelMark[] {
        const { midpoints } = this
        const items = this.marks
            .map((d, i) => ({
                color: d.color,
                seriesName: d.seriesName,
                label: this.manager.table.getLabelForEntityName(d.seriesName),
                yValue: midpoints[i],
            }))
            .reverse()
        return items
    }

    @computed get maxLegendWidth() {
        return Math.min(150, this.bounds.width / 3)
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendDimensions(): LineLegend | undefined {
        if (this.manager.hideLegend) return undefined
        return new LineLegend({ manager: this })
    }

    @observable hoverIndex?: number
    @action.bound onHover(hoverIndex: number | undefined) {
        this.hoverIndex = hoverIndex
    }

    @observable hoverKey?: string
    @action.bound onLegendClick() {
        if (this.manager.showAddEntityControls)
            this.manager.isSelectingData = true
    }

    @computed private get dualAxis() {
        const { bounds } = this
        const { horizontalAxisPart, verticalAxisPart, legendDimensions } = this
        return new DualAxis({
            bounds: bounds.padRight(
                legendDimensions ? legendDimensions.width : 20
            ),
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @action.bound onLegendMouseOver(key: EntityName) {
        this.hoverKey = key
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    @computed get focusedSeriesNames() {
        return this.hoverKey ? [this.hoverKey] : []
    }

    @computed get isFocusMode() {
        return this.focusedSeriesNames.length > 0
    }

    seriesIsBlur(series: StackedAreaSeries) {
        return (
            this.focusedSeriesNames.length > 0 &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get tooltip() {
        if (this.hoverIndex === undefined) return undefined

        const { hoverIndex, dualAxis, manager, marks } = this

        // Grab the first value to get the year from
        const refValue = marks[0].points[hoverIndex]

        // If some data is missing, don't calculate a total
        const someMissing = marks.some((g) => !!g.points[hoverIndex].isFake)

        const legendBlockStyle = {
            width: "10px",
            height: "10px",
            display: "inline-block",
            marginRight: "2px",
        }

        return (
            <Tooltip
                tooltipManager={this.props.manager}
                x={dualAxis.horizontalAxis.place(refValue.x)}
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
                                    {this.manager.table.timeColumnFormatFunction(
                                        refValue.x
                                    )}
                                </strong>
                            </td>
                            <td></td>
                        </tr>
                        {reverse(clone(marks)).map((series) => {
                            const value = series.points[hoverIndex]
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
                                        {manager.table.getLabelForEntityName(
                                            series.seriesName
                                        )}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        {value.isFake
                                            ? "No data"
                                            : this.formatYTick(value.origY!)}
                                    </td>
                                </tr>
                            )
                        })}
                        {/* Total */}
                        {!someMissing && (
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
                                            {this.formatYTick(
                                                marks[marks.length - 1].points[
                                                    hoverIndex
                                                ].y
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

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    componentDidMount() {
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

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid() {
        return guid()
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, bounds, dualAxis, renderUid, marks } = this

        const showLegend = !this.manager.hideLegend

        return (
            <g ref={this.base} className="StackedArea">
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        <rect
                            x={dualAxis.innerBounds.x}
                            y={bounds.y}
                            width={bounds.width}
                            height={bounds.height * 2}
                        ></rect>
                    </clipPath>
                </defs>
                <DualAxisComponent
                    isInteractive={manager.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {showLegend && <LineLegend manager={this} />}
                    <Areas
                        dualAxis={dualAxis}
                        seriesArr={marks}
                        focusedSeriesNames={this.focusedSeriesNames}
                        onHover={this.onHover}
                    />
                </g>
                {this.tooltip}
            </g>
        )
    }

    @computed get legendX(): number {
        return this.legendDimensions
            ? this.bounds.right - this.legendDimensions.width
            : 0
    }

    @computed get failMessage() {
        const { yColumn } = this
        if (!yColumn) return "Missing Y axis columns"

        if (!this.marks.length) return "No matching data"

        return ""
    }

    @computed private get horizontalAxisPart() {
        const { manager } = this
        const { startTimelineTime, endTimelineTime } = this.yColumn!
        const axisConfig = this.manager.xAxis || new AxisConfig(undefined, this)
        if (this.manager.hideXAxis) axisConfig.hideAxis = true
        const axis = axisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([
            startTimelineTime,
            endTimelineTime,
        ])
        axis.formatColumn = manager.table.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed get verticalAxis() {
        return this.dualAxis.verticalAxis
    }

    @computed private get verticalAxisPart() {
        const { yColumn } = this
        const yValues = this.allStackedValues.map((d) => d.y)
        const axisConfig = this.manager.yAxis || new AxisConfig(undefined, this)
        if (this.manager.hideYAxis) axisConfig.hideAxis = true
        const axis = axisConfig.toVerticalAxis()
        // Use user settings for axis, unless relative mode
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings([0, max(yValues) ?? 100]) // Stacked area chart must have its own y domain)
        axis.formatColumn = yColumn
        return axis
    }

    @computed get availableTimes(): Time[] {
        // Since we've already aligned the data, the years of any series corresponds to the years of all of them
        return this.marks[0]?.points.map((v) => v.x) || []
    }

    @computed private get colorScheme() {
        //return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
        const colorScheme = ColorSchemes[this.manager.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["stackedAreaDefault"] as ColorScheme)
    }

    @computed get table() {
        let table = this.manager.table
        table = table.filterBySelectedOnly()

        if (this.manager.isRelativeMode)
            table = this.isStackedEntities
                ? table.toPercentageFromEachEntityForEachTime(
                      this.yColumnSlugs[0]
                  )
                : table.toPercentageFromEachColumnForEachEntityAndTime(
                      this.yColumnSlugs
                  )
        return table
    }

    @computed private get yColumn() {
        return this.table.get(
            this.manager.yColumnSlug ?? this.manager.yColumnSlugs![0]
        )
    }

    @computed private get yColumnSlugs() {
        return this.manager.yColumnSlugs
            ? this.manager.yColumnSlugs
            : this.manager.yColumnSlug
            ? [this.manager.yColumnSlug]
            : []
    }

    @computed private get yColumns() {
        return this.manager.yColumnSlugs
            ? this.manager.yColumnSlugs.map((slug) => this.table.get(slug)!)
            : [this.yColumn!]
    }

    @computed get colorScale() {
        const seriesCount = this.isStackedEntities
            ? this.table.selectedEntityNames.length
            : this.yColumns.length
        const baseColors = this.colorScheme.getColors(seriesCount)
        if (this.manager.invertColorScheme) baseColors.reverse()
        return scaleOrdinal(baseColors)
    }

    // It seems we have 2 types of StackedAreas. If only 1 column, we stack
    // the entities, and have one series per entity. If 2+ columns, we stack the columns
    // and have 1 series per column.
    @computed private get isStackedEntities() {
        return this.yColumnSlugs.length === 1
    }

    @computed get marks() {
        const rawSeries = this.isStackedEntities
            ? this.entitiesAsSeries
            : this.columnsAsSeries

        rawSeries.reverse()
        stackAreas(rawSeries)
        return rawSeries
    }

    @computed private get columnsAsSeries() {
        const { yColumns } = this
        return yColumns.map(
            (col): StackedAreaSeries => {
                const { isProjection } = col
                const seriesName = col.displayName
                const points = col.owidRows.map((row) => {
                    return {
                        x: row.time,
                        y: row.value,
                        time: row.time,
                        origY: row.value,
                    }
                })
                return {
                    seriesName,
                    isProjection,
                    points,
                    color:
                        // table.getColorForEntityName(entityName) || todo: readd custom colors.
                        this.colorScale(seriesName), // temp
                }
            }
        )
    }

    @computed private get entitiesAsSeries() {
        const yColumn = this.yColumn!
        return Array.from(yColumn.owidRowsByEntityName.keys()).map(
            (entityName: EntityName): StackedAreaSeries => {
                const { isProjection } = yColumn
                const seriesName = entityName
                const points = yColumn.owidRowsByEntityName
                    .get(entityName)!
                    .map((row) => {
                        return {
                            x: row.time,
                            y: row.value,
                            time: row.time,
                            origY: row.value,
                        }
                    })
                return {
                    seriesName,
                    isProjection,
                    points,
                    color:
                        // table.getColorForEntityName(entityName) || todo: readd custom colors.
                        this.colorScale(seriesName), // temp
                }
            }
        )
    }

    // // Get the data for each stacked area series, cleaned to ensure every series
    // // "lines up" i.e. has a data point for every year
    //     // Now ensure that every series has a value entry for every year in the data
    //     let allYears: number[] = []
    //     groupedData.forEach((series) =>
    //         allYears.push(...series.points.map((d) => d.x))
    //     )
    //     allYears = sortNumeric(uniq(allYears))

    //     groupedData.forEach((series) => {
    //         let i = 0
    //         let isBeforeStart = true

    //         while (i < allYears.length) {
    //             const value = series.points[i] as StackedAreaPoint | undefined
    //             const expectedYear = allYears[i]

    //             if (value === undefined || value.x > allYears[i]) {
    //                 let fakeY = NaN

    //                 if (!isBeforeStart && i < series.points.length) {
    //                     // Missing data in the middle-- interpolate a value
    //                     const prevValue = series.points[i - 1]
    //                     const nextValue = series.points[i]
    //                     fakeY = (nextValue.y + prevValue.y) / 2
    //                 }

    //                 series.points.splice(i, 0, {
    //                     x: expectedYear,
    //                     y: fakeY,
    //                     time: expectedYear,
    //                     isFake: true,
    //                 })
    //             } else {
    //                 isBeforeStart = false
    //             }
    //             i += 1
    //         }
    //     })

    //     // Strip years at start and end where we couldn't successfully interpolate
    //     for (const firstSeries of groupedData.slice(0, 1)) {
    //         for (let i = firstSeries.points.length - 1; i >= 0; i--) {
    //             if (groupedData.some((series) => isNaN(series.points[i].y))) {
    //                 for (const series of groupedData) {
    //                     series.points.splice(i, 1)
    //                 }
    //             }
    //         }
    //     }
    // }

    @computed private get allStackedValues() {
        return flatten(this.marks.map((series) => series.points))
    }

    private formatYTick(v: number) {
        const { yColumn } = this
        return yColumn ? yColumn.formatValueShort(v) : v // todo: restore { noTrailingZeroes: false }
    }
}
