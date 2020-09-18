import * as React from "react"
import { select } from "d3-selection"
import { min, max, maxBy, orderBy, sortBy, uniq } from "grapher/utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import {
    Color,
    TickFormattingOptions,
    ScaleType,
    Time,
    BASE_FONT_SIZE,
} from "grapher/core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "grapher/axis/AxisViews"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { AddEntityButton } from "grapher/controls/AddEntityButton"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { EntityName } from "owidTable/OwidTableConstants"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorSchemes } from "grapher/color/ColorSchemes"

interface DiscreteBarDatum {
    entityName: EntityName
    value: number
    time: Time
    label: string
    color: Color
}

const labelToTextPadding = 10
const labelToBarPadding = 5

export interface DiscreteBarChartOptionsProvider extends ChartOptionsProvider {
    addButtonLabel?: string
    hasFloatingAddButton?: boolean
    showYearLabels?: boolean
    yAxis?: AxisConfig // just pass interface?
}

@observer
export class DiscreteBarChart extends React.Component<{
    bounds: Bounds
    options: DiscreteBarChartOptionsProvider
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get options() {
        return this.props.options
    }
    @computed.struct private get bounds() {
        return this.props.bounds.padRight(10)
    }

    @computed private get displayData() {
        // Uses allData when the timeline handles are being dragged, and currentData otherwise
        return this.options.useTimelineDomains ? this.allData : this.currentData
    }

    @computed private get baseFontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get legendLabelStyle() {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle() {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get legendWidth() {
        const labels = this.currentData.map((d) => d.label)
        if (this.hasFloatingAddButton)
            labels.push(` + ${this.options.addButtonLabel ?? "Add data"}`)

        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.legendLabelStyle).width
    }

    @computed private get hasPositive() {
        return this.displayData.some((d) => d.value >= 0)
    }

    @computed private get hasNegative() {
        return this.displayData.some((d) => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed private get rightEndLabelWidth(): number {
        if (this.hasPositive) {
            const positiveLabels = this.displayData
                .filter((d) => d.value >= 0)
                .map((d) => this.barValueFormat(d))
            const longestPositiveLabel = maxBy(positiveLabels, (l) => l.length)
            return Bounds.forText(longestPositiveLabel, this.valueLabelStyle)
                .width
        } else {
            return 0
        }
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftEndLabelWidth(): number {
        if (this.hasNegative) {
            const negativeLabels = this.displayData
                .filter((d) => d.value < 0)
                .map((d) => this.barValueFormat(d))
            const longestNegativeLabel = maxBy(negativeLabels, (l) => l.length)
            return (
                Bounds.forText(longestNegativeLabel, this.valueLabelStyle)
                    .width + labelToTextPadding
            )
        } else {
            return 0
        }
    }

    @computed private get x0(): number {
        if (this.isLogScale) {
            const minValue = min(this.allData.map((d) => d.value))
            return minValue !== undefined ? Math.min(1, minValue) : 1
        }
        return 0
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const allValues = this.displayData.map((d) => d.value)

        const minStart = this.x0
        return [
            Math.min(minStart, min(allValues) as number),
            Math.max(minStart, max(allValues) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.bounds.left + this.legendWidth + this.leftEndLabelWidth,
            this.bounds.right - this.rightEndLabelWidth,
        ]
    }

    @computed private get yAxis() {
        return this.options.yAxis || new AxisConfig()
    }

    @computed private get axis() {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.yAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.tickFormatFn = this.tickFormat
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds() {
        return this.bounds
            .padLeft(this.legendWidth + this.leftEndLabelWidth)
            .padBottom(this.axis.height)
            .padRight(this.rightEndLabelWidth)
    }

    @computed private get hasFloatingAddButton() {
        return (
            this.options.hasFloatingAddButton &&
            this.options.showAddEntityControls
        )
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed private get totalBars() {
        return this.hasFloatingAddButton
            ? this.currentData.length + 1
            : this.currentData.length
    }

    @computed private get barHeight() {
        return (0.8 * this.innerBounds.height) / this.totalBars
    }

    @computed private get barSpacing() {
        return this.innerBounds.height / this.totalBars - this.barHeight
    }

    @computed private get barPlacements() {
        const { currentData, axis } = this
        return currentData.map((d) => {
            const isNegative = d.value < 0
            const barX = isNegative ? axis.place(d.value) : axis.place(this.x0)
            const barWidth = isNegative
                ? axis.place(this.x0) - barX
                : axis.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    @computed private get barWidths() {
        return this.barPlacements.map((b) => b.width)
    }

    private d3Bars() {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    private animateBarWidth() {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    componentDidMount() {
        this.d3Bars().attr("width", 0)
        this.animateBarWidth()
    }

    componentDidUpdate() {
        // Animating the bar width after a render ensures there's no race condition, where the
        // initial animation (in componentDidMount) did override the now-changed bar width in
        // some cases. Updating the animation with the updated bar widths fixes that.
        this.animateBarWidth()
    }

    @action.bound onAddClick() {
        this.options.isSelectingData = true
    }

    get addEntityButton() {
        if (!this.hasFloatingAddButton) return undefined
        const y =
            this.bounds.top +
            (this.barHeight + this.barSpacing) * (this.totalBars - 1) +
            this.barHeight / 2
        const paddingTop = AddEntityButton.calcPaddingTop(
            y,
            "middle",
            this.barHeight
        )
        return (
            <ControlsOverlay id="add-country" paddingTop={paddingTop}>
                <AddEntityButton
                    x={this.bounds.left + this.legendWidth}
                    y={y}
                    align="right"
                    verticalAlign="middle"
                    height={this.barHeight}
                    label={`Add ${this.options.entityType}`}
                    onClick={this.onAddClick}
                />
            </ControlsOverlay>
        )
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataOverlay
                    options={this.options}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            currentData,
            bounds,
            axis,
            innerBounds,
            barHeight,
            barSpacing,
            barValueFormat,
        } = this

        let yOffset = innerBounds.top + barHeight / 2

        const maxX = bounds.width + 40 // This is only used to shift the ScaleSelector left if it exceeds the container. Hard coded for now but could be improved

        return (
            <g ref={this.base} className="DiscreteBarChart">
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <HorizontalAxisComponent
                    maxX={maxX}
                    bounds={bounds}
                    isInteractive={this.options.isInteractive}
                    axis={axis}
                    axisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={axis}
                    bounds={innerBounds}
                />
                {currentData.map((d) => {
                    const isNegative = d.value < 0
                    const barX = isNegative
                        ? axis.place(d.value)
                        : axis.place(this.x0)
                    const barWidth = isNegative
                        ? axis.place(this.x0) - barX
                        : axis.place(d.value) - barX
                    const valueLabel = barValueFormat(d)
                    const labelX = isNegative
                        ? barX -
                          Bounds.forText(valueLabel, this.valueLabelStyle)
                              .width -
                          labelToTextPadding
                        : barX - labelToBarPadding

                    // Using transforms for positioning to enable better (subpixel) transitions
                    // Width transitions don't work well on iOS Safari – they get interrupted and
                    // it appears very slow. Also be careful with negative bar charts.
                    const result = (
                        <g
                            key={d.entityName}
                            className="bar"
                            transform={`translate(0, ${yOffset})`}
                            style={{ transition: "transform 200ms ease" }}
                        >
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${labelX}, 0)`}
                                fill="#555"
                                dominantBaseline="middle"
                                textAnchor="end"
                                {...this.legendLabelStyle}
                            >
                                {d.label}
                            </text>
                            <rect
                                x={0}
                                y={0}
                                transform={`translate(${barX}, ${
                                    -barHeight / 2
                                })`}
                                width={barWidth}
                                height={barHeight}
                                fill={d.color}
                                opacity={0.85}
                                style={{ transition: "height 200ms ease" }}
                            />
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${
                                    axis.place(d.value) +
                                    (isNegative
                                        ? -labelToBarPadding
                                        : labelToBarPadding)
                                }, 0)`}
                                fill="#666"
                                dominantBaseline="middle"
                                textAnchor={isNegative ? "end" : "start"}
                                {...this.valueLabelStyle}
                            >
                                {valueLabel}
                            </text>
                        </g>
                    )

                    yOffset += barHeight + barSpacing

                    return result
                })}
                {this.addEntityButton}
            </g>
        )
    }

    @computed get failMessage() {
        const column = this.primaryColumns[0]

        if (!column) return "Missing column"

        return column.isEmpty ? "No matching data" : undefined
    }

    @computed get primaryColumns() {
        return this.options.primaryColumns ? this.options.primaryColumns : []
    }

    @computed get availableTimes(): Time[] {
        return this.primaryColumns[0]?.timesUniq || []
    }

    @computed get barValueFormat(): (datum: DiscreteBarDatum) => string {
        const column = this.primaryColumns[0]
        const { endTimelineTime } = column
        const { table } = this.options

        return (datum: DiscreteBarDatum) => {
            const showYearLabels =
                this.options.showYearLabels || datum.time !== endTimelineTime
            const displayValue = column.formatValue(datum.value)
            return (
                displayValue +
                (showYearLabels
                    ? ` (${table.timeColumnFormatFunction(datum.time)})`
                    : "")
            )
        }
    }

    @computed get tickFormat(): (
        d: number,
        options?: TickFormattingOptions
    ) => string {
        const primaryColumns = this.primaryColumns
        return primaryColumns[0]
            ? primaryColumns[0].formatValueShort
            : (d: number) => `${d}`
    }

    @computed get currentData() {
        const { options, primaryColumns } = this
        const { table } = options
        const primaryColumn = primaryColumns[0]
        if (!primaryColumn) return []
        const targetTime = primaryColumn.endTimelineTime
        const { getColorForEntityName, getLabelForEntityName } = table

        const rows = table
            .getClosestRowForEachSelectedEntity(
                targetTime,
                primaryColumn.tolerance
            )
            .map((row) => {
                const { entityName, time } = row
                const value = row[primaryColumn.slug]

                if (this.isLogScale && value <= 0) return null

                const datum: DiscreteBarDatum = {
                    entityName,
                    value,
                    time,
                    label: getLabelForEntityName(entityName),
                    color: "#2E5778",
                }
                return datum
            })
            .filter((row) => row) as DiscreteBarDatum[]

        const sortedRows = sortBy(rows, (row) => row.value)

        // if (this.grapher.isLineChart) {
        //     // If derived from line chart, use line chart colors
        //     for (const key in dataByEntityName) {
        //         const lineSeries = this.grapher.lineChartTransform.predomainData.find(
        //             (series) => series.entityName === key
        //         )
        //         if (lineSeries) dataByEntityName[key].color = lineSeries.color
        //     }
        // } else {
        const uniqValues = uniq(sortedRows.map((row) => row.value))
        const colorScheme = options.baseColorScheme
            ? ColorSchemes[options.baseColorScheme]
            : undefined
        const colors = colorScheme?.getColors(uniqValues.length) || []
        if (options.invertColorScheme) colors.reverse()

        // We want to display same values using the same color, e.g. two values of 100 get the same shade of green
        // Therefore, we create a map from all possible (unique) values to the corresponding color
        const colorByValue = new Map<number, string>()
        uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))

        sortedRows.forEach((row) => {
            row.color =
                getColorForEntityName(row.entityName) ||
                colorByValue.get(row.value) ||
                row.color
        })
        return orderBy(sortedRows, ["value", "entityName"], ["desc", "asc"])
    }

    private _filterArrayForLogScale(allData: DiscreteBarDatum[]) {
        // It seems the approach we follow with log scales in the other charts is to filter out zero values.
        // This is because, as d3 puts it: "a log scale domain must be strictly-positive or strictly-negative;
        // the domain must not include or cross zero". We may want to update to d3 5.8 and explore switching to
        // scaleSymlog which handles a wider domain.
        return allData.filter((datum) => datum.value > 0)
    }

    @computed private get isLogScale() {
        return this.yAxis.scaleType === ScaleType.log
    }

    @computed get allData() {
        //if (!this.hasTimeline)
        return this.currentData

        // const { grapher } = this
        // const {
        //     selectedEntityNameSet,
        //     getColorForEntityName,
        //     getLabelForEntityName,
        // } = grapher.table
        // const filledDimensions = grapher.filledDimensions
        // const allData: DiscreteBarDatum[] = []

        // filledDimensions.forEach((dimension) => {
        //     const { column } = dimension

        //     for (let i = 0; i < column.times.length; i++) {
        //         const year = column.times[i]
        //         const entityName = column.entityNames[i]

        //         if (!selectedEntityNameSet.has(entityName)) continue

        //         const datum = {
        //             entityName,
        //             value: +column.values[i],
        //             year,
        //             label: getLabelForEntityName(entityName),
        //             color: "#2E5778",
        //         }

        //         allData.push(datum)
        //     }
        // })

        // const filteredData = this.isLogScale
        //     ? this._filterArrayForLogScale(allData)
        //     : allData

        // const data = sortNumeric(filteredData, (d) => d.value)
        // const colorScheme = grapher.baseColorScheme
        //     ? ColorSchemes[grapher.baseColorScheme]
        //     : undefined
        // const uniqValues = sortedUniq(data.map((d) => d.value))
        // const colors = colorScheme?.getColors(uniqValues.length) || []
        // if (grapher.invertColorScheme) colors.reverse()

        // const colorByValue = new Map<number, string>()
        // uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))

        // data.forEach((d) => {
        //     d.color =
        //         getColorForEntityName(d.entityName) ||
        //         colorByValue.get(d.value) ||
        //         d.color
        // })

        // return sortNumeric(data, (d) => d.value, SortOrder.desc)
    }
}
