import * as React from "react"
import {
    min,
    max,
    maxBy,
    last,
    flatten,
    excludeUndefined,
    sortBy,
    sumBy,
    sum,
} from "../../clientUtils/Util"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { BASE_FONT_SIZE, SeriesName } from "../core/GrapherConstants"
import {
    DualAxisComponent,
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface, ChartSeries } from "../chart/ChartInterface"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { stackSeries } from "./StackedUtils"
import { ChartManager } from "../chart/ChartManager"
import { Color, Time } from "../../clientUtils/owidTypes"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import { EntityName, LegacyOwidRow } from "../../coreTable/OwidTableConstants"
import {
    LegendAlign,
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { TippyIfInteractive } from "../chart/Tippy"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import { isDarkColor } from "../color/ColorUtils"
import { VerticalColorLegendManager } from "../verticalColorLegend/VerticalColorLegend"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { countries } from "../../clientUtils/countries"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { ColorSchemeName } from "../color/ColorConstants"

const labelToBarPadding = 5

export interface MarimekkoChartManager extends ChartManager {
    endTime?: Time
}

interface Item {
    label: string
    bars: Bar[]
}

interface SimplePoint {
    value: number
    entity: string
    time: number
    color: Color
}

export interface SimpleChartSeries extends ChartSeries {
    points: SimplePoint[]
}

interface Bar {
    color: Color
    seriesName: string
    xPoint: SimplePoint
    yPoint: StackedPoint<EntityName>
}

interface TooltipProps {
    label: string
    bars: Bar[]
    highlightedSeriesName?: string
    targetTime?: Time
    timeColumn: CoreColumn
    formatColumn: CoreColumn
}

@observer
export class MarimekkoChart
    extends React.Component<{
        bounds?: Bounds
        manager: MarimekkoChartManager
    }>
    implements ChartInterface, HorizontalColorLegendManager, ColorScaleManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable) {
        if (!this.yColumnSlugs.length) return table
        if (!this.xColumnSlug) return table

        // table = table.filterByEntityNames(
        //     this.selectionArray.selectedEntityNames
        // )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        table = table.interpolateColumnWithTolerance(this.xColumnSlug)
        table = table.dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)
        table = table.dropRowsWithErrorValuesForAnyColumn([this.xColumnSlug])

        if (this.manager.isRelativeMode) {
            table = table.toPercentageFromEachEntityForEachTime(
                this.xColumnSlug
            )
        }

        if (this.colorColumnSlug) {
            const tolerance =
                table.get(this.colorColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.colorColumnSlug,
                tolerance
            )
            if (this.manager.matchingEntitiesOnly) {
                table = table.dropRowsWithErrorValuesForColumn(
                    this.colorColumnSlug
                )
            }
        }
        return table
    }

    @computed get entityNameSlug() {
        return "entityName"
    }

    @observable focusSeriesName?: SeriesName

    @computed get inputTable() {
        return this.manager.table
    }

    @computed get transformedTable() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed private get bounds() {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed private get baseFontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelStyle() {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 700,
        }
    }

    // Account for the width of the legend
    @computed private get labelWidth() {
        const labels = this.items.map((item) => item.label)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.labelStyle).width
    }

    @computed private get x0() {
        return 0
    }

    @computed private get y0() {
        return 0
    }

    @computed private get allPoints(): StackedPoint<EntityName>[] {
        return flatten(this.series.map((series) => series.points))
    }

    // Now we can work out the main x axis scale
    @computed private get yDomainDefault(): [number, number] {
        const maxValues = this.allPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [
            Math.min(this.y0, min(maxValues) as number),
            Math.max(this.y0, max(maxValues) as number),
        ]
    }

    @computed private get xDomainCorrectionFactor(): number {
        // Rounding up every country so that it is at least one pixel wide
        // on the X axis has a pretty annoying side effect: since there are
        // quite a few very small countries that get rounded up, the normal
        // placing on the X axis ends up overshooting the naive domain max value
        // by quite a bit.
        // Correcting for this naively is a simple job of calculating the domain
        // amount of one pixel, counting the countries below that and adjusting by
        // a simple factor. BUT this would now make the normal placement on the x
        // axis map the value we calculated above of "one pixel worth of domain amount"
        // to *slightly less* than one pixel, screwing up the rounding to pixel borders
        // that is required to avoid SVG hairline artifacts.
        // Instead what we do below is sort all x axis values ascending and then
        // continously adjusting the one pixel domain value. This way we make sure
        // that in the final placement everything fits. In other words, what we are
        // doing is that we count all entities that would be less than one pixel WHILE
        // updating this threshold to take into account that the "normal" range gets
        // smaller by one pixel whenever we enlarge one small country to one pixel.

        const points = this.xSeries.points
            .map((point) => point.value)
            .sort((a, b) => a - b)
        const total = sum(points)
        const widthInPixels = this.xRange[1] - this.xRange[0]
        let onePixelDomainValueEquivalent = total / widthInPixels
        let numCountriesBelowOnePixel = 0
        let sumToRemoveFromTotal = 0
        for (let i = 0; i < points.length; i++) {
            if (points[i] >= onePixelDomainValueEquivalent) break
            numCountriesBelowOnePixel++
            sumToRemoveFromTotal += points[i]
            onePixelDomainValueEquivalent =
                total / (widthInPixels - numCountriesBelowOnePixel)
        }
        return (
            (total -
                numCountriesBelowOnePixel * onePixelDomainValueEquivalent) /
            (total - sumToRemoveFromTotal)
        )
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const sum = sumBy(this.xSeries.points, (point) => point.value)

        return [0, sum]
    }

    @computed private get yRange(): [number, number] {
        return [
            this.bounds.top - this.legend.height,
            this.bounds.bottom - this.labelWidth,
        ]
    }

    @computed private get xRange(): [number, number] {
        return [this.bounds.left, this.bounds.right]
    }

    @computed private get yAxisPart() {
        return this.manager.yAxis || new AxisConfig()
    }

    @computed private get xAxisPart() {
        return this.manager.xAxis || new AxisConfig()
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axis = this.yAxisPart.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(this.yDomainDefault)

        axis.formatColumn = this.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.yRange
        axis.label = ""
        return axis
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisPart.toHorizontalAxis()
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.formatColumn = this.xColumn // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.bounds.padBottom(this.legendPaddingTop),
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed private get innerBounds() {
        // return this.bounds
        //     .padLeft(this.labelWidth)
        //     .padBottom(this.dualAxis.height)
        //     .padTop(this.legendPaddingTop)
        //     .padTop(this.legend.height)
        return this.dualAxis.innerBounds
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    @computed private get items(): Item[] {
        const entityNames = new Set(
            this.xSeries.points.map((point) => point.entity)
        )

        const items: Item[] = Array.from(entityNames)
            .map((entityName) => {
                const xPoint = this.xSeries.points.find(
                    (point) => point.entity === entityName
                )
                if (!xPoint) return undefined
                return {
                    label: entityName,
                    bars: excludeUndefined(
                        this.series.map((series): Bar | undefined => {
                            const point = series.points.find(
                                (point) => point.position === entityName
                            )
                            if (!point) return undefined
                            return {
                                xPoint,
                                yPoint: point,
                                color: xPoint.color, //series.color,
                                seriesName: series.seriesName,
                            }
                        })
                    ),
                }
            })
            .filter((item) => item?.bars.length) as Item[]

        // if (this.manager.isRelativeMode) {
        //     // TODO: This is more of a stopgap to prevent the chart from being super jumpy in
        //     // relative mode. Once we have an option to sort by a specific metric, that'll help.
        //     // Until then, we're sorting by label to prevent any jumping.
        //     return sortBy(items, (item) => item.label)
        // } else {
        return sortBy(items, (item) => {
            const lastPoint = last(item.bars)?.yPoint
            if (!lastPoint) return 0
            return lastPoint.valueOffset + lastPoint.value
        }).reverse()
        // }
    }

    // legend props

    @computed get legendPaddingTop(): number {
        return 0
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return 0
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): LegendAlign {
        return LegendAlign.left
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.series.map((series, index) => {
            return new CategoricalBin({
                index,
                value: series.seriesName,
                label: series.seriesName,
                color: series.color,
            })
        })
    }

    @action.bound onLegendMouseOver(bin: CategoricalBin) {
        this.focusSeriesName = bin.value
    }

    @action.bound onLegendMouseLeave() {
        this.focusSeriesName = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const { bounds, dualAxis, innerBounds } = this

        return (
            <g ref={this.base} className="MarimekkoChart">
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={true} />
                <HorizontalCategoricalColorLegend manager={this} />
                {this.renderBars()}
            </g>
        )
    }

    private renderBars() {
        const results: JSX.Element[] = []
        const { dualAxis, x0, xDomainCorrectionFactor } = this
        let currentX = Math.round(dualAxis.horizontalAxis.place(this.x0))
        let isEven = true
        for (const { label, bars } of this.items) {
            // Using transforms for positioning to enable better (subpixel) transitions
            // Width transitions don't work well on iOS Safari – they get interrupted and
            // it appears very slow. Also be careful with negative bar charts.
            const tooltipProps = {
                label,
                bars,
                targetTime: this.manager.endTime,
                timeColumn: this.inputTable.timeColumn,
                formatColumn: this.formatColumn,
            }

            const exactWidth =
                dualAxis.horizontalAxis.place(bars[0].xPoint.value) -
                dualAxis.horizontalAxis.place(x0)
            const correctedWidth = exactWidth * xDomainCorrectionFactor
            const barWidth = correctedWidth > 1 ? Math.round(correctedWidth) : 1
            const result = (
                <g
                    key={label}
                    className="bar"
                    transform={`translate(${currentX}, 0)`}
                >
                    {/* <TippyIfInteractive
                        lazy
                        isInteractive={!this.manager.isExportingtoSvgOrPng}
                        hideOnClick={false}
                        content={<MarimekkoChart.Tooltip {...tooltipProps} />}
                    >
                        <text
                            x={0}
                            y={0}
                            // TODO: rotate labels
                            transform={`translate(${
                                dualAxis.horizontalAxis.place(this.x0) -
                                labelToBarPadding
                            }, 0)`}
                            fill="#000"
                            dominantBaseline="middle"
                            textAnchor="end"
                            {...this.labelStyle}
                        >
                            {label}
                        </text>
                    </TippyIfInteractive> */}
                    {bars.map((bar) =>
                        this.renderBar(
                            bar,
                            {
                                ...tooltipProps,
                                highlightedSeriesName: bar.seriesName,
                            },
                            isEven,
                            barWidth
                        )
                    )}
                </g>
            )
            results.push(result)
            currentX += barWidth
            isEven = !isEven
        }
        return results
    }

    // TODO: remove
    private get roundX(): boolean {
        return true
    }

    private renderBar(
        bar: Bar,
        tooltipProps: TooltipProps,
        isEven: boolean,
        barWidth: number
    ) {
        const {
            dualAxis,
            formatColumn,
            focusSeriesName,
            roundX,
            fontSize,
        } = this
        const { xPoint, yPoint, color, seriesName } = bar

        const isFaint =
            focusSeriesName !== undefined && focusSeriesName !== seriesName
        const barY = dualAxis.verticalAxis.place(this.y0 + yPoint.valueOffset)
        const barHeight =
            dualAxis.verticalAxis.place(this.y0) -
            dualAxis.verticalAxis.place(yPoint.value)
        const barX = 0

        // Compute how many decimal places we should show.
        // Basically, this makes us show 2 significant digits, or no decimal places if the number
        // is big enough already.
        const dp = Math.ceil(-Math.log10(yPoint.value) + 1)
        const barLabel = tooltipProps.label
        const labelBounds = Bounds.forText(barLabel, {
            fontSize: 0.7 * this.baseFontSize,
        })
        // Check that we have enough space to show the bar label
        const showLabelInsideBar =
            labelBounds.height < 0.85 * barWidth &&
            labelBounds.width < 0.85 * barHeight
        const labelColor = isDarkColor(color) ? "#fff" : "#000"

        const labelX = barX + barWidth / 2
        const labelY = barY - labelBounds.width / 2 - fontSize

        return (
            <TippyIfInteractive
                lazy
                isInteractive={!this.manager.isExportingtoSvgOrPng}
                key={seriesName}
                hideOnClick={false}
                content={<MarimekkoChart.Tooltip {...tooltipProps} />}
            >
                <g>
                    <rect
                        x={0}
                        y={0}
                        shapeRendering="crispEdges"
                        transform={`translate(${barX}, ${barY - barHeight})`}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        //stroke="#4979d0"
                        opacity={isFaint ? 0.1 : isEven ? 0.85 : 0.82}
                        style={{
                            transition: "translate 200ms ease",
                        }}
                    />
                    {showLabelInsideBar && (
                        <text
                            x={0}
                            y={0}
                            width={barWidth}
                            height={barHeight}
                            fill={labelColor}
                            transform={`rotate(-90, ${labelX}, ${labelY}) translate(${labelX}, ${labelY})`}
                            opacity={isFaint ? 0 : 1}
                            fontSize="0.7em"
                            textAnchor="middle"
                            dominantBaseline="middle"
                        >
                            {barLabel}
                        </text>
                    )}
                </g>
            </TippyIfInteractive>
        )
    }

    private static Tooltip(props: TooltipProps) {
        let hasTimeNotice = false

        return (
            <table
                style={{
                    lineHeight: "1em",
                    whiteSpace: "normal",
                    borderSpacing: "0.5em",
                }}
            >
                <tbody>
                    <tr>
                        <td colSpan={4} style={{ color: "#111" }}>
                            <strong>{props.label}</strong>
                        </td>
                    </tr>
                    {props.bars.map((bar) => {
                        const { highlightedSeriesName } = props
                        const squareColor = bar.color
                        const isHighlighted =
                            bar.seriesName === highlightedSeriesName
                        const isFaint =
                            highlightedSeriesName !== undefined &&
                            !isHighlighted
                        const shouldShowTimeNotice =
                            bar.yPoint.value !== undefined &&
                            bar.yPoint.time !== props.targetTime
                        hasTimeNotice ||= shouldShowTimeNotice

                        return (
                            <tr
                                key={`${bar.seriesName}`}
                                style={{
                                    color: isHighlighted
                                        ? "#000"
                                        : isFaint
                                        ? "#707070"
                                        : "#444",
                                    fontWeight: isHighlighted
                                        ? "bold"
                                        : undefined,
                                }}
                            >
                                <td>
                                    <div
                                        style={{
                                            width: "10px",
                                            height: "10px",
                                            backgroundColor: squareColor,
                                            display: "inline-block",
                                        }}
                                    />
                                </td>
                                <td
                                    style={{
                                        paddingRight: "0.8em",
                                        fontSize: "0.9em",
                                    }}
                                >
                                    {bar.seriesName}
                                </td>
                                <td
                                    style={{
                                        textAlign: "right",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {bar.yPoint.value === undefined
                                        ? "No data"
                                        : props.formatColumn.formatValueShort(
                                              bar.yPoint.value,
                                              {
                                                  noTrailingZeroes: false,
                                              }
                                          )}
                                </td>
                                {shouldShowTimeNotice && (
                                    <td
                                        style={{
                                            fontWeight: "normal",
                                            color: "#707070",
                                            fontSize: "0.8em",
                                            whiteSpace: "nowrap",
                                            paddingLeft: "8px",
                                        }}
                                    >
                                        <span className="icon">
                                            <FontAwesomeIcon
                                                icon={faInfoCircle}
                                                style={{
                                                    marginRight: "0.25em",
                                                }}
                                            />{" "}
                                        </span>
                                        {props.timeColumn.formatValue(
                                            bar.xPoint.time
                                        )}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    {hasTimeNotice && (
                        <tr>
                            <td
                                colSpan={4}
                                style={{
                                    color: "#707070",
                                    fontSize: "0.8em",
                                    paddingTop: "10px",
                                }}
                            >
                                <div style={{ display: "flex" }}>
                                    <span
                                        className="icon"
                                        style={{ marginRight: "0.5em" }}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                    </span>
                                    <span>
                                        No data available for{" "}
                                        {props.timeColumn.formatValue(
                                            props.targetTime
                                        )}
                                        . Showing closest available data point
                                        instead.
                                    </span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        )
    }

    @computed get failMessage() {
        const column = this.yColumns[0]

        if (!column) return "No column to chart"

        if (!this.selectionArray.hasSelection) return `No data selected`

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? `No matching data in columns ${this.yColumnSlugs.join(", ")}`
            : ""
    }

    @computed protected get yColumnSlugs() {
        return (
            this.manager.yColumnSlugsInSelectionOrder ??
            autoDetectYColumnSlugs(this.manager)
        )
    }

    @computed protected get xColumnSlug() {
        return this.manager.xColumnSlug
    }

    @computed protected get xColumn() {
        const columnSlugs = this.xColumnSlug ? [this.xColumnSlug] : []
        if (!columnSlugs.length) console.warn("No x column slug!")
        return this.transformedTable.getColumns(columnSlugs)[0]
    }

    @computed protected get yColumns() {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed private get colorScheme() {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : undefined) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed private get colorColumnSlug() {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn() {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    colorScale = new ColorScale(this)
    @computed get colorScaleConfig() {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = "#959595"

    @computed get colorScaleColumn() {
        // We need to use inputTable in order to get consistent coloring for a variable across
        // charts, e.g. each continent being assigned to the same color.
        // inputTable is unfiltered, so it contains every value that exists in the variable.
        return this.inputTable.get(this.colorColumnSlug)
    }

    @computed private get unstackedSeries(): StackedSeries<EntityName>[] {
        return (
            this.yColumns
                .map((col, i) => {
                    return {
                        seriesName: col.displayName,
                        color:
                            col.def.color ??
                            this.colorScheme.getColors(this.yColumns.length)[i],
                        points: col.owidRows.map((row) => ({
                            time: row.time,
                            position: row.entityName,
                            value: row.value,
                            valueOffset: 0,
                        })),
                    }
                })
                // Do not plot columns without data
                .filter((series) => series.points.length > 0)
        )
    }

    @computed get series(): readonly StackedSeries<EntityName>[] {
        return stackSeries(this.unstackedSeries)
    }

    @computed get xSeries(): SimpleChartSeries {
        // TODO: make entity colors (continents work)
        // const keyColor = this.transformedTable.getColorForEntityName(
        //     entityName
        // )
        const createStackedXPoints = (rows: LegacyOwidRow<any>[]) => {
            const points: SimplePoint[] = []
            for (const row of rows) {
                const colorDomainValue = this.colorColumn.owidRows.find(
                    (colorrow) => colorrow.entityName === row.entityName
                )

                const color = colorDomainValue
                    ? this.colorScale.getColor(colorDomainValue.value)
                    : undefined

                if (color) {
                    // drop entities that have not been assigned a color for now
                    // TODO: this will be an issue for non-country entities
                    points.push({
                        time: row.time,
                        value: row.value,
                        entity: row.entityName,
                        color: color,
                    })
                }
            }
            return points
        }
        const column = this.xColumn
        return {
            seriesName: column.displayName,
            color: column.def.color || "#55a", // TODO: default color?
            points: createStackedXPoints(column.owidRows),
        }
    }
}
