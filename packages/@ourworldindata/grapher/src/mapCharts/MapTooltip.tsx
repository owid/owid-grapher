import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Tooltip, TooltipValue, TooltipState } from "../tooltip/Tooltip"
import { MapChartManager } from "./MapChartConstants"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    Time,
    OwidTable,
    EntityName,
    OwidVariableRow,
} from "@ourworldindata/core-table"
import { LineChart } from "../lineCharts/LineChart"
import {
    Bounds,
    isNumber,
    AllKeysRequired,
    checkIsVeryShortUnit,
    PrimitiveType,
    isString,
    first,
    last,
    min,
    max,
} from "@ourworldindata/utils"
import { LineChartManager } from "../lineCharts/LineChartConstants"
import { darkenColorForHighContrastText } from "../color/ColorUtils"

interface MapTooltipProps {
    tooltipState: TooltipState<{ featureId: string; clickable: boolean }>
    manager: MapChartManager
    colorScaleManager: ColorScaleManager
    formatValue: (d: PrimitiveType) => string
    timeSeriesTable: OwidTable
    targetTime?: Time
}

const SPARKLINE_WIDTH = 250
const SPARKLINE_HEIGHT = 87
const SPARKLINE_PADDING = 15 // same as $inset in scss

@observer
export class MapTooltip extends React.Component<MapTooltipProps> {
    @computed private get mapColumnSlug(): string | undefined {
        return this.props.manager.mapColumnSlug
    }

    @computed private get mapAndYColumnAreTheSame(): boolean {
        const { yColumnSlug, yColumnSlugs, mapColumnSlug } = this.props.manager
        return yColumnSlugs && mapColumnSlug !== undefined
            ? yColumnSlugs.includes(mapColumnSlug)
            : yColumnSlug === mapColumnSlug
    }

    @computed private get entityName(): EntityName {
        return this.props.tooltipState.target?.featureId ?? ""
    }

    // Table pre-filtered by targetTime, exlcudes time series
    @computed private get mapTable(): OwidTable {
        const table =
            this.props.manager.transformedTable ?? this.props.manager.table
        return table.filterByEntityNames([this.entityName])
    }

    @computed private get timeSeriesTable(): OwidTable | undefined {
        if (this.mapColumnSlug === undefined) return undefined
        return this.props.timeSeriesTable
            .filterByEntityNames([this.entityName])
            .columnFilter(
                this.mapColumnSlug,
                isNumber,
                "Drop rows with non-number values in Y column"
            )
            .sortBy([this.props.timeSeriesTable.timeColumn.slug])
    }

    @computed private get datum():
        | OwidVariableRow<number | string>
        | undefined {
        return this.mapTable.get(this.mapColumnSlug).owidRows[0]
    }

    @computed private get hasTimeSeriesData(): boolean {
        return this.timeSeriesTable !== undefined
            ? this.timeSeriesTable.numRows > 1
            : false
    }

    @computed private get lineColorScale(): ColorScale {
        const oldManager = this.props.colorScaleManager
        // Make sure all ColorScaleManager props are included.
        // We can't ...rest here because I think mobx computeds aren't
        // enumerable or something.
        const newManager: AllKeysRequired<ColorScaleManager> = {
            colorScaleConfig: oldManager.colorScaleConfig,
            hasNoDataBin: oldManager.hasNoDataBin,
            defaultNoDataColor: oldManager.defaultNoDataColor,
            defaultBaseColorScheme: oldManager.defaultBaseColorScheme,
            colorScaleColumn: oldManager.colorScaleColumn,
        }
        return new ColorScale(newManager)
    }

    @computed private get showSparkline(): boolean {
        return this.hasTimeSeriesData
    }

    // Line chart fields
    @computed private get sparklineTable(): OwidTable {
        return this.timeSeriesTable ?? new OwidTable()
    }
    @computed private get sparklineManager(): LineChartManager {
        // use the whole time range for the sparkline, not just the range where this series has data
        let { minTime, maxTime } = this.props.timeSeriesTable ?? {}
        if (this.mapColumnSlug) {
            const times =
                this.props.timeSeriesTable.getTimesUniqSortedAscForColumns([
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
            selection: [this.entityName],
            colorScaleOverride: this.lineColorScale,
            hideLegend: true,
            hidePoints: true,
            fontSize: 11,
            disableIntroAnimation: true,
            lineStrokeWidth: 2,
            annotation: {
                entityName: this.entityName,
                year: this.datum?.time,
            },
            yAxisConfig: {
                hideAxis: true,
                hideGridlines: false,
                tickFormattingOptions: {
                    unit: yAxisUnit,
                    numberAbbreviation: "short",
                },
                // Copy min/max from top-level Grapher config if Y column == Map column
                min: this.mapAndYColumnAreTheSame
                    ? this.props.manager.yAxisConfig?.min
                    : undefined,
                max: this.mapAndYColumnAreTheSame
                    ? this.props.manager.yAxisConfig?.max
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
                min: minTime ?? this.props.targetTime,
                max: maxTime ?? this.props.targetTime,
                ticks: [
                    // Show minimum and maximum
                    { value: -Infinity, priority: 1 },
                    { value: Infinity, priority: 1 },
                ],
            },
        }
    }

    render(): JSX.Element {
        const { mapTable, datum, lineColorScale } = this
        const {
            targetTime,
            formatValue,
            tooltipState: { target, position, fading },
        } = this.props

        const { timeColumn } = mapTable
        const displayTime = !timeColumn.isMissing
            ? timeColumn.formatValue(targetTime)
            : targetTime?.toString()
        const displayDatumTime =
            timeColumn && datum
                ? timeColumn.formatValue(datum?.time)
                : datum?.time.toString() ?? ""
        const valueColor: string | undefined = darkenColorForHighContrastText(
                lineColorScale?.getColor(datum?.value) ?? "#333"
            ),
            valueLabel = datum ? formatValue(datum.value) : undefined

        const { yAxisConfig } = this.sparklineManager,
            yColumn = this.sparklineTable.get(this.mapColumnSlug),
            minVal = min([yColumn.min, yAxisConfig?.min]),
            maxVal = max([yColumn.max, yAxisConfig?.max]),
            minCustom =
                isNumber(minVal) &&
                this.lineColorScale.getBinForValue(minVal)?.label,
            maxCustom =
                isNumber(maxVal) &&
                this.lineColorScale.getBinForValue(maxVal)?.label,
            useCustom = isString(minCustom) && isString(maxCustom),
            minLabel = useCustom
                ? minCustom
                : yColumn.formatValueShort(minVal ?? 0),
            maxLabel = useCustom
                ? maxCustom
                : yColumn.formatValueShort(maxVal ?? 0)

        const notice =
            datum && datum.time !== targetTime ? displayTime : undefined

        return (
            <Tooltip
                id="mapTooltip"
                tooltipManager={this.props.manager}
                key="mapTooltip"
                x={position.x}
                y={position.y}
                style={{ maxWidth: "250px" }}
                offsetX={20}
                offsetY={-16}
                offsetYDirection={"downward"}
                title={target?.featureId}
                subtitle={datum ? displayDatumTime : displayTime}
                subtitleFormat={notice ? "notice" : undefined}
                footer={notice}
                footerFormat="notice"
                dissolve={fading}
            >
                <TooltipValue
                    column={yColumn}
                    value={valueLabel}
                    color={valueColor}
                />
                {this.showSparkline && (
                    <div
                        className="sparkline"
                        // negative margin to align the padding (added below) with the text labels
                        style={{ margin: `0 -${SPARKLINE_PADDING}px` }}
                    >
                        <svg
                            className="plot"
                            width={SPARKLINE_WIDTH}
                            height={SPARKLINE_HEIGHT}
                        >
                            <line
                                className="max-line"
                                x1={SPARKLINE_PADDING}
                                y1={SPARKLINE_PADDING}
                                x2={SPARKLINE_WIDTH - SPARKLINE_PADDING}
                                y2={SPARKLINE_PADDING}
                            />
                            <LineChart
                                manager={this.sparklineManager}
                                // Add padding so that the edges of the plot doesn't get clipped.
                                // The plot can go out of boundaries due to line stroke thickness & labels.
                                bounds={new Bounds(
                                    0,
                                    0,
                                    SPARKLINE_WIDTH,
                                    SPARKLINE_HEIGHT
                                ).pad({
                                    top: SPARKLINE_PADDING,
                                    left: SPARKLINE_PADDING,
                                    right: SPARKLINE_PADDING,
                                    bottom: 3,
                                })}
                            />

                            {maxLabel !== minLabel && (
                                <g className="max axis-label">
                                    <text>{maxLabel}</text>
                                </g>
                            )}

                            <g className="min axis-label">
                                <text className="outline">{minLabel}</text>
                                <text>{minLabel}</text>
                            </g>
                        </svg>
                    </div>
                )}
            </Tooltip>
        )
    }
}
