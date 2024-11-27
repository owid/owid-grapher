import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    AxisConfigInterface,
    ColumnSlug,
    EntityName,
    OwidVariableRoundingMode,
    OwidVariableRow,
    Time,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { LineChart } from "../lineCharts/LineChart"
import {
    Bounds,
    isNumber,
    checkIsVeryShortUnit,
    isString,
    first,
    last,
    min,
    max,
} from "@ourworldindata/utils"
import { LineChartManager } from "../lineCharts/LineChartConstants"
import { ColorScale } from "../color/ColorScale.js"

const DEFAULT_SPARKLINE_WIDTH = 250
const DEFAULT_SPARKLINE_HEIGHT = 87

const SPARKLINE_PADDING = 15
const SPARKLINE_NUDGE = 3 // step away from the axis

export interface MapSparklineManager {
    mapColumnSlug?: ColumnSlug
    timeSeriesTable: OwidTable
    targetTime?: Time
    entityName: EntityName
    lineColorScale?: ColorScale
    datum?: OwidVariableRow<number | string>
    mapAndYColumnAreTheSame?: boolean
    yAxisConfig?: AxisConfigInterface
}

@observer
export class MapSparkline extends React.Component<{
    manager: MapSparklineManager
    sparklineWidth?: number
    sparklineHeight?: number
}> {
    static shouldShow(manager: MapSparklineManager): boolean {
        const test = new MapSparkline({ manager })
        return test.showSparkline
    }

    @computed private get manager(): MapSparklineManager {
        return this.props.manager
    }

    @computed private get mapColumnSlug(): ColumnSlug | undefined {
        return this.manager.mapColumnSlug
    }

    @computed private get sparklineTable(): OwidTable {
        if (this.mapColumnSlug === undefined) return new OwidTable()

        return this.manager.timeSeriesTable
            .filterByEntityNames([this.manager.entityName])
            .columnFilter(
                this.mapColumnSlug,
                isNumber,
                "Drop rows with non-number values in Y column"
            )
            .sortBy([this.manager.timeSeriesTable.timeColumn.slug])
    }

    @computed private get hasTimeSeriesData(): boolean {
        return this.sparklineTable !== undefined
            ? this.sparklineTable.numRows > 1
            : false
    }

    @computed private get showSparkline(): boolean {
        return this.hasTimeSeriesData
    }

    @computed private get sparklineManager(): LineChartManager {
        // use the whole time range for the sparkline, not just the range where this series has data
        let { minTime, maxTime } = this.manager.timeSeriesTable ?? {}
        if (this.mapColumnSlug) {
            const times =
                this.manager.timeSeriesTable.getTimesUniqSortedAscForColumns([
                    this.mapColumnSlug,
                ])
            minTime = first(times) ?? minTime
            maxTime = last(times) ?? maxTime
        }

        // Pass down short units, while omitting long or undefined ones.
        const unit = this.sparklineTable.get(this.mapColumnSlug).shortUnit
        const yAxisUnit =
            typeof unit === "string"
                ? checkIsVeryShortUnit(unit)
                    ? unit
                    : ""
                : ""

        return {
            table: this.sparklineTable,
            transformedTable: this.sparklineTable,
            yColumnSlug: this.mapColumnSlug,
            colorColumnSlug: this.mapColumnSlug,
            selection: [this.manager.entityName],
            colorScaleOverride: this.manager.lineColorScale,
            showLegend: false,
            hidePoints: true,
            fontSize: 11,
            disableIntroAnimation: true,
            lineStrokeWidth: 2,
            entityYearHighlight: {
                entityName: this.manager.entityName,
                year: this.manager.datum?.originalTime,
            },
            yAxisConfig: {
                hideAxis: true,
                hideGridlines: false,
                tickFormattingOptions: {
                    unit: yAxisUnit,
                    numberAbbreviation: "short",
                },
                // Copy min/max from top-level Grapher config if Y column == Map column
                min: this.manager.mapAndYColumnAreTheSame
                    ? this.manager.yAxisConfig?.min
                    : undefined,
                max: this.manager.mapAndYColumnAreTheSame
                    ? this.manager.yAxisConfig?.max
                    : undefined,
                ticks: [
                    // Show minimum and zero (maximum is added by hand in render so it's never omitted)
                    { value: -Infinity, priority: 2 },
                    { value: 0, priority: 1 },
                ],
            },
            xAxisConfig: {
                hideAxis: false,
                hideGridlines: true,
                tickFormattingOptions: {},
                min: minTime ?? this.manager.targetTime,
                max: maxTime ?? this.manager.targetTime,
                ticks: [
                    // Show minimum and maximum
                    { value: -Infinity, priority: 1 },
                    { value: Infinity, priority: 1 },
                ],
            },
        }
    }

    @computed private get sparklineWidth(): number {
        return this.props.sparklineWidth ?? DEFAULT_SPARKLINE_WIDTH
    }

    @computed private get sparklineHeight(): number {
        return this.props.sparklineHeight ?? DEFAULT_SPARKLINE_HEIGHT
    }

    @computed private get sparklineBounds(): Bounds {
        // Add padding so that the edges of the plot doesn't get clipped.
        // The plot can go out of boundaries due to line stroke thickness & labels.
        return new Bounds(0, 0, this.sparklineWidth, this.sparklineHeight).pad({
            top: 9,
            left: SPARKLINE_PADDING,
            right: SPARKLINE_PADDING,
            bottom: 3,
        })
    }

    @computed private get sparklineChart(): LineChart {
        return new LineChart({
            manager: this.sparklineManager,
            bounds: this.sparklineBounds,
        })
    }

    render(): React.ReactElement | null {
        if (!this.showSparkline) return null

        const { yAxisConfig } = this.sparklineManager,
            yColumn = this.sparklineTable.get(this.mapColumnSlug),
            minVal = min([yColumn.min, yAxisConfig?.min]),
            maxVal = max([yColumn.max, yAxisConfig?.max]),
            minCustom =
                isNumber(minVal) &&
                this.manager.lineColorScale?.getBinForValue(minVal)?.label,
            maxCustom =
                isNumber(maxVal) &&
                this.manager.lineColorScale?.getBinForValue(maxVal)?.label,
            useCustom = isString(minCustom) && isString(maxCustom),
            minLabel = useCustom
                ? minCustom
                : yColumn.formatValueShort(minVal ?? 0, {
                      roundingMode: OwidVariableRoundingMode.decimalPlaces,
                  }),
            maxLabel = useCustom
                ? maxCustom
                : yColumn.formatValueShort(maxVal ?? 0, {
                      roundingMode: OwidVariableRoundingMode.decimalPlaces,
                  })
        const { innerBounds: axisBounds } = this.sparklineChart.dualAxis

        const labelX = axisBounds.right - SPARKLINE_NUDGE
        const labelTop = axisBounds.top - SPARKLINE_NUDGE
        const labelBottom = axisBounds.bottom - SPARKLINE_NUDGE

        return (
            <div
                className="sparkline"
                // negative margin to align the padding (added below) with the text labels
                style={{ margin: `0 -${SPARKLINE_PADDING}px` }}
            >
                <svg
                    className="plot"
                    width={this.sparklineWidth}
                    height={this.sparklineHeight}
                >
                    <line
                        className="max-line"
                        x1={axisBounds.left}
                        y1={axisBounds.y}
                        x2={axisBounds.right}
                        y2={axisBounds.y}
                    />
                    <LineChart
                        manager={this.sparklineManager}
                        bounds={this.sparklineBounds}
                    />
                    {maxLabel !== minLabel && (
                        <g className="max axis-label">
                            <text x={labelX} y={labelTop}>
                                {maxLabel}
                            </text>
                        </g>
                    )}
                    <g className="min axis-label">
                        <text className="outline" x={labelX} y={labelBottom}>
                            {minLabel}
                        </text>
                        <text x={labelX} y={labelBottom}>
                            {minLabel}
                        </text>
                    </g>
                </svg>
            </div>
        )
    }
}
