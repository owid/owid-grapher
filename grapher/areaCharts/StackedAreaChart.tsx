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
    sortBy,
    cloneDeep,
    sum,
    flatten,
    sortNumeric,
    uniq,
    max,
    formatValue,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { scaleOrdinal } from "d3-scale"
import { Time, BASE_FONT_SIZE, ValueRange } from "grapher/core/GrapherConstants"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import {
    LineLabelMark,
    LineLegend,
    LineLegendOptionsProvider,
} from "grapher/lineLegend/LineLegend"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { rgb } from "d3-color"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { EntityName } from "coreTable/CoreTableConstants"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    AreasProps,
    StackedAreaSeries,
    StackedAreaValue,
} from "./StackedAreaChartConstants"

const BLUR_COLOR = "#ddd"

@observer
class Areas extends React.Component<AreasProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable hoverIndex?: number

    @action.bound private onCursorMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ) {
        const { dualAxis, data } = this.props

        const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

        if (dualAxis.innerBounds.contains(mouse)) {
            const closestPoint = minBy(data[0].values, (d) =>
                Math.abs(dualAxis.horizontalAxis.place(d.x) - mouse.x)
            )
            if (closestPoint) {
                const index = data[0].values.indexOf(closestPoint)
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
            this.props.focusKeys.length > 0 &&
            !this.props.focusKeys.includes(series.entityName)
        )
    }

    @computed private get areas(): JSX.Element[] {
        const { dualAxis, data } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        const xBottomLeft = [horizontalAxis.range[0], verticalAxis.range[0]]
        const xBottomRight = [horizontalAxis.range[1], verticalAxis.range[0]]

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        let prevPoints = [xBottomLeft, xBottomRight]
        return data.map((series) => {
            const mainPoints = series.values.map(
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
                    className={makeSafeForCSS(series.entityName) + "-area"}
                    key={series.entityName + "-area"}
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
        const { dualAxis, data } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        return data.map((series) => {
            const points = series.values.map(
                (v) =>
                    [horizontalAxis.place(v.x), verticalAxis.place(v.y)] as [
                        number,
                        number
                    ]
            )

            return (
                <path
                    className={makeSafeForCSS(series.entityName) + "-border"}
                    key={series.entityName + "-border"}
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
        const { dualAxis, data } = this.props
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
                        {data.map((series) => {
                            return this.seriesIsBlur(series) ? null : (
                                <circle
                                    key={series.entityName}
                                    cx={horizontalAxis.place(
                                        series.values[hoverIndex].x
                                    )}
                                    cy={verticalAxis.place(
                                        series.values[hoverIndex].y
                                    )}
                                    r={2}
                                    fill={series.color}
                                />
                            )
                        })}
                        <line
                            x1={horizontalAxis.place(
                                data[0].values[hoverIndex].x
                            )}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(
                                data[0].values[hoverIndex].x
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
        options: ChartOptionsProvider
    }>
    implements ChartInterface, LineLegendOptionsProvider {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get options() {
        return this.props.options
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get midpoints() {
        let prevY = 0
        return this.marks.map((series) => {
            const lastValue = last(series.values)
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
                entityName: d.entityName,
                label: this.options.table.getLabelForEntityName(d.entityName),
                yValue: midpoints[i],
            }))
            .reverse()
        return items
    }

    @computed get maxLegendWidth() {
        return Math.min(150, this.bounds.width / 3)
    }

    @computed get fontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendDimensions() {
        if (this.options.hideLegend) return undefined
        return new LineLegend({ options: this })
    }

    @observable hoverIndex?: number
    @action.bound onHover(hoverIndex: number | undefined) {
        this.hoverIndex = hoverIndex
    }

    @observable hoverKey?: string
    @action.bound onLegendClick() {
        if (this.options.showAddEntityControls)
            this.options.isSelectingData = true
    }

    @computed private get dualAxis() {
        const { bounds } = this
        const { horizontalAxis, verticalAxis, legendDimensions } = this
        return new DualAxis({
            bounds: bounds.padRight(
                legendDimensions ? legendDimensions.width : 20
            ),
            horizontalAxis,
            verticalAxis,
        })
    }

    @action.bound onLegendMouseOver(key: EntityName) {
        this.hoverKey = key
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    @computed get focusedEntityNames() {
        return this.hoverKey ? [this.hoverKey] : []
    }

    @computed get isFocusMode() {
        return this.focusedEntityNames.length > 0
    }

    seriesIsBlur(series: StackedAreaSeries) {
        return (
            this.focusedEntityNames.length > 0 &&
            !this.focusedEntityNames.includes(series.entityName)
        )
    }

    @computed private get tooltip() {
        if (this.hoverIndex === undefined) return undefined

        const { hoverIndex, dualAxis, options, marks } = this

        // Grab the first value to get the year from
        const refValue = marks[0].values[hoverIndex]

        // If some data is missing, don't calculate a total
        const someMissing = marks.some((g) => !!g.values[hoverIndex].isFake)

        const legendBlockStyle = {
            width: "10px",
            height: "10px",
            display: "inline-block",
            marginRight: "2px",
        }

        return (
            <Tooltip
                tooltipProvider={this.props.options}
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
                                    {this.options.table.timeColumnFormatFunction(
                                        refValue.x
                                    )}
                                </strong>
                            </td>
                            <td></td>
                        </tr>
                        {reverse(clone(marks)).map((series) => {
                            const value = series.values[hoverIndex]
                            const isBlur = this.seriesIsBlur(series)
                            const textColor = isBlur ? "#ddd" : "#333"
                            const blockColor = isBlur
                                ? BLUR_COLOR
                                : series.color
                            return (
                                <tr
                                    key={series.entityName}
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
                                        {options.table.getLabelForEntityName(
                                            series.entityName
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
                                                marks[marks.length - 1].values[
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
                <NoDataOverlay
                    options={this.options}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { options, bounds, dualAxis, renderUid, marks } = this

        const showLegend = !this.options.hideLegend

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
                    isInteractive={options.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {showLegend && <LineLegend options={this} />}
                    <Areas
                        dualAxis={dualAxis}
                        data={marks}
                        focusKeys={this.focusedEntityNames}
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
        else if (
            this.groupedData.length === 0 ||
            this.groupedData[0].values.length === 0
        )
            return "No matching data"

        return ""
    }

    // Get the data for each stacked area series, cleaned to ensure every series
    // "lines up" i.e. has a data point for every year
    @computed private get groupedData() {
        const { options, yColumns, table } = this
        const { selectedEntityNameSet, selectedEntityNames } = table

        let groupedData: StackedAreaSeries[] = []

        if (!yColumns?.length) return []

        // First, we populate the data as we would for a line chart (each series independently)
        yColumns!.forEach((column) => {
            const seriesByKey = new Map<EntityName, StackedAreaSeries>()

            const { isProjection } = column

            for (let i = 0; i < column.times.length; i++) {
                const year = column.times[i]
                const value = +column.parsedValues[i]
                const entityName = column.entityNames[i]
                let series = seriesByKey.get(entityName)

                // Not a selected key, don't add any data for it
                if (!selectedEntityNameSet.has(entityName)) continue
                // Must be numeric
                if (isNaN(value)) continue
                // Stacked area chart can't go negative!
                if (value < 0) continue

                if (!series) {
                    series = {
                        values: [],
                        entityName,
                        isProjection,
                        color: "#fff", // tmp
                    }
                    seriesByKey.set(entityName, series)
                }

                series.values.push({ x: year, y: value, time: year })
            }

            groupedData = groupedData.concat([
                ...Array.from(seriesByKey.values()),
            ])
        })

        // Now ensure that every series has a value entry for every year in the data
        let allYears: number[] = []
        groupedData.forEach((series) =>
            allYears.push(...series.values.map((d) => d.x))
        )
        allYears = sortNumeric(uniq(allYears))

        groupedData.forEach((series) => {
            let i = 0
            let isBeforeStart = true

            while (i < allYears.length) {
                const value = series.values[i] as StackedAreaValue | undefined
                const expectedYear = allYears[i]

                if (value === undefined || value.x > allYears[i]) {
                    let fakeY = NaN

                    if (!isBeforeStart && i < series.values.length) {
                        // Missing data in the middle-- interpolate a value
                        const prevValue = series.values[i - 1]
                        const nextValue = series.values[i]
                        fakeY = (nextValue.y + prevValue.y) / 2
                    }

                    series.values.splice(i, 0, {
                        x: expectedYear,
                        y: fakeY,
                        time: expectedYear,
                        isFake: true,
                    })
                } else {
                    isBeforeStart = false
                }
                i += 1
            }
        })

        // Strip years at start and end where we couldn't successfully interpolate
        for (const firstSeries of groupedData.slice(0, 1)) {
            for (let i = firstSeries.values.length - 1; i >= 0; i--) {
                if (groupedData.some((series) => isNaN(series.values[i].y))) {
                    for (const series of groupedData) {
                        series.values.splice(i, 1)
                    }
                }
            }
        }

        // Preserve order
        groupedData = sortBy(
            groupedData,
            (series) => -selectedEntityNames.indexOf(series.entityName)
        )

        // Assign colors
        const baseColors = this.colorScheme.getColors(groupedData.length)
        if (options.invertColorScheme) baseColors.reverse()
        const colorScale = scaleOrdinal(baseColors)
        groupedData.forEach((series) => {
            series.color =
                table.getColorForEntityName(series.entityName) ||
                colorScale(series.entityName)
        })

        // In relative mode, transform data to be a percentage of the total for that year
        if (options.isRelativeMode) {
            if (groupedData.length === 0) return []

            for (let i = 0; i < groupedData[0].values.length; i++) {
                const total = sum(
                    groupedData.map((series) => series.values[i].y)
                )
                for (let j = 0; j < groupedData.length; j++) {
                    groupedData[j].values[i].y =
                        total === 0
                            ? 0
                            : (groupedData[j].values[i].y / total) * 100
                }
            }
        }

        return groupedData
    }

    @computed private get yAxis() {
        return this.options.yAxis || new AxisConfig(undefined, this)
    }

    @computed private get xAxis() {
        return this.options.xAxis || new AxisConfig(undefined, this)
    }

    @computed private get horizontalAxis() {
        const { xDomainDefault, options } = this
        const axis = this.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(xDomainDefault)
        axis.column = options.table.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yDomainDefault(): ValueRange {
        const yValues = this.allStackedValues.map((d) => d.y)
        return [0, max(yValues) ?? 100]
    }

    @computed get verticalAxis() {
        const { options, yDomainDefault, yColumn } = this
        const { isRelativeMode } = options

        const axis = this.yAxis.toVerticalAxis()
        if (isRelativeMode) axis.domain = [0, 100]
        else
            axis.updateDomainPreservingUserSettings([
                yDomainDefault[0],
                yDomainDefault[1],
            ]) // Stacked area chart must have its own y domain)

        axis.column = yColumn
        return axis
    }

    @computed get availableTimes(): Time[] {
        // Since we've already aligned the data, the years of any series corresponds to the years of all of them
        return this.groupedData[0]?.values.map((v) => v.x) || []
    }

    @computed private get colorScheme() {
        //return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
        const colorScheme = ColorSchemes[this.options.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["stackedAreaDefault"] as ColorScheme)
    }

    @computed private get table() {
        return this.options.table
    }

    @computed private get yColumn() {
        return this.table.get(
            this.options.yColumnSlug ?? this.options.yColumnSlugs![0]
        )
    }

    @computed private get yColumns() {
        return (this.options.yColumnSlugs || []).map(
            (slug) => this.table.get(slug)!
        )
    }

    @computed private get xDomainDefault(): ValueRange {
        const { startTimelineTime, endTimelineTime } = this.yColumn!
        return [startTimelineTime, endTimelineTime]
    }

    // Apply time filtering and stacking
    @computed get marks() {
        const { groupedData } = this

        const { startTimelineTime, endTimelineTime } = this.yColumn!

        if (
            groupedData.some(
                (series) =>
                    series.values.length !== groupedData[0].values.length
            )
        )
            throw new Error(
                `Unexpected variation in stacked area chart series: ${groupedData.map(
                    (series) => series.values.length
                )}`
            )

        const stackedData = cloneDeep(groupedData)

        for (const series of stackedData) {
            series.values = series.values.filter(
                (v) => v.x >= startTimelineTime && v.x <= endTimelineTime
            )
            for (const value of series.values) {
                value.origY = value.y
            }
        }

        for (let i = 1; i < stackedData.length; i++) {
            for (let j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].y += stackedData[i - 1].values[j].y
            }
        }

        return stackedData
    }

    @computed private get allStackedValues() {
        return flatten(this.marks.map((series) => series.values))
    }

    private formatYTick(v: number) {
        if (this.options.isRelativeMode) return formatValue(v, { unit: "%" })

        const { yColumn } = this

        return yColumn ? yColumn.formatValueShort(v) : v // todo: restore { noTrailingZeroes: false }
    }
}
