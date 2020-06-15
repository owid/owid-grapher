import { computed } from "mobx"

import {
    valuesByEntityAtYears,
    es6mapValues,
    valuesByEntityWithinYears,
    getStartEndValues
} from "./Util"
import { ChartConfig } from "./ChartConfig"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { TickFormattingOptions } from "./TickFormattingOptions"
import { getTimeWithinTimeRange, Time } from "./TimeBounds"

// Target year modes

export enum TargetYearMode {
    point = "point",
    range = "range"
}

type TargetYears = [number] | [number, number]

// Sorting modes

export enum SortOrder {
    asc = "asc",
    desc = "desc"
}

// Dimensions

export interface Dimension {
    dimension: ChartDimensionWithOwidVariable
    columns: DimensionColumn[]
    valueByEntity: Map<string, DimensionValue>
}

export interface DimensionColumn {
    key: SingleValueKey | RangeValueKey
    targetYear?: number
    targetYearMode?: TargetYearMode
}

// Data value types

export interface Value {
    value?: string | number
    formattedValue?: string
    year?: number
}

// range (two point values)

export enum RangeValueKey {
    start = "start",
    end = "end",
    delta = "delta",
    deltaRatio = "deltaRatio"
}

export type RangeValue = Record<RangeValueKey, Value | undefined>

export function isRangeValue(value: DimensionValue): value is RangeValue {
    return "start" in value
}

// single point values

export enum SingleValueKey {
    single = "single"
}

export type SingleValue = Record<SingleValueKey, Value | undefined>

export function isSingleValue(value: DimensionValue): value is SingleValue {
    return "single" in value
}

// combined types

export type DimensionValue = SingleValue | RangeValue

export type ColumnKey = SingleValueKey | RangeValueKey

// Data table types

export interface Sortable {
    sortable: boolean
}

export interface DataTableDimension extends Sortable {
    key: number
    name: string
    unit?: string
    columns: DataTableColumn[]
    formatYear: (num: number) => string
}

export type DataTableColumn = DimensionColumn & Sortable

export interface DataTableRow {
    entity: string
    dimensionValues: (DimensionValue | undefined)[] // TODO make it not undefined
}

// Utilities

function getHeaderUnit(unit: string) {
    return unit !== "%" ? unit : "percent"
}

function getValueUnit(unit: string) {
    return unit !== "%" ? undefined : unit
}

export class DataTableTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get dimensions() {
        return this.chart.data.filledDimensions
    }

    @computed get entities() {
        return this.chart.data.availableEntities
    }

    // TODO move this logic to chart
    @computed get targetYearMode(): TargetYearMode {
        const { tab } = this.chart
        if (tab === "chart") {
            if (
                (this.chart.isLineChart &&
                    !this.chart.lineChart.isSingleYear) ||
                this.chart.isStackedArea ||
                this.chart.isStackedBar
            ) {
                return TargetYearMode.range
            }
            if (
                this.chart.isScatter &&
                !this.chart.scatter.compareEndPointsOnly
            ) {
                return TargetYearMode.range
            }
        }
        return TargetYearMode.point
    }

    @computed get minYear(): Time {
        return this.chart.data.minYear
    }

    @computed get maxYear(): Time {
        return this.chart.data.maxYear
    }

    // TODO move this logic to chart
    @computed get targetYears(): TargetYears {
        const mapTarget = this.chart.map.targetYear
        const [startYear, endYear] = this.chart.timeDomain
        const timeRange: [Time, Time] = [this.minYear, this.maxYear]
        if (this.chart.tab === "map") {
            return [getTimeWithinTimeRange(timeRange, mapTarget)]
        } else if (startYear === endYear) {
            return [getTimeWithinTimeRange(timeRange, startYear)]
        } else {
            return [
                getTimeWithinTimeRange(timeRange, startYear),
                getTimeWithinTimeRange(timeRange, endYear)
            ]
        }
    }

    formatValue(
        dimension: ChartDimensionWithOwidVariable,
        value: number | string | undefined,
        formattingOverrides?: TickFormattingOptions
    ): string | undefined {
        if (value === undefined) return value
        return dimension.formatValueShort(value, {
            autoPrefix: false,
            noTrailingZeroes: false,
            unit: getValueUnit(dimension.unit),
            ...formattingOverrides
        })
    }

    @computed get dimensionsWithValues(): Dimension[] {
        return this.dimensions
            .filter(dim => dim.includeInTable)
            .map(dim => {
                const targetYears =
                    // If a targetYear override is specified on the dimension (scatter plots
                    // can do this) then use that target year and ignore the timeline.
                    dim.targetYear !== undefined && this.chart.isScatter
                        ? [dim.targetYear]
                        : this.targetYears

                const targetYearMode =
                    targetYears.length < 2
                        ? TargetYearMode.point
                        : this.targetYearMode

                const valuesByEntity =
                    targetYearMode === TargetYearMode.range
                        ? // In the "range" mode, we receive all data values within the range. But we
                          // only want to plot the start & end values in the table.
                          // getStartEndValues() extracts these two values.
                          es6mapValues(
                              valuesByEntityWithinYears(
                                  dim.valueByEntityAndYear,
                                  targetYears
                              ),
                              getStartEndValues
                          )
                        : valuesByEntityAtYears(
                              dim.valueByEntityAndYear,
                              targetYears,
                              dim.tolerance
                          )

                const isRange = targetYears.length === 2

                // Inject delta columns if we have start & end values to compare in the table.
                // One column for absolute difference, another for % difference.
                const deltaColumns: DimensionColumn[] = isRange
                    ? [
                          { key: RangeValueKey.delta },
                          { key: RangeValueKey.deltaRatio }
                      ]
                    : []

                const columns: DimensionColumn[] = [
                    ...targetYears.map((targetYear, index) => ({
                        key: isRange
                            ? index === 0
                                ? RangeValueKey.start
                                : RangeValueKey.end
                            : SingleValueKey.single,
                        targetYear,
                        targetYearMode
                    })),
                    ...deltaColumns
                ]

                const finalValueByEntity = es6mapValues(valuesByEntity, dvs => {
                    // There is always a column, but not always a data value (in the delta column the
                    // value needs to be calculated)
                    if (isRange) {
                        const [start, end]: (Value | undefined)[] = dvs
                        const result: RangeValue = {
                            start: {
                                ...start,
                                formattedValue: this.formatValue(
                                    dim,
                                    start?.value
                                )
                            },
                            end: {
                                ...end,
                                formattedValue: this.formatValue(
                                    dim,
                                    end?.value
                                )
                            },
                            delta: undefined,
                            deltaRatio: undefined
                        }

                        if (
                            start !== undefined &&
                            end !== undefined &&
                            typeof start.value === "number" &&
                            typeof end.value === "number"
                        ) {
                            const deltaValue = end.value - start.value
                            const deltaRatioValue =
                                (end.value - start.value) / start.value

                            result.delta = {
                                value: deltaValue,
                                formattedValue: this.formatValue(
                                    dim,
                                    deltaValue,
                                    {
                                        showPlus: true
                                    }
                                )
                            }

                            result.deltaRatio = {
                                value: deltaRatioValue,
                                formattedValue:
                                    isFinite(deltaRatioValue) &&
                                    !isNaN(deltaRatioValue)
                                        ? this.formatValue(
                                              dim,
                                              deltaRatioValue * 100,
                                              {
                                                  unit: "%",
                                                  numDecimalPlaces: 0,
                                                  showPlus: true
                                              }
                                          )
                                        : undefined
                            }
                        }
                        return result
                    } else {
                        // if single year
                        const dv = dvs[0]
                        const result: SingleValue = {
                            single: { ...dv }
                        }
                        if (dv !== undefined) {
                            result.single!.formattedValue = this.formatValue(
                                dim,
                                dv.value
                            )
                        }
                        return result
                    }
                })

                return {
                    dimension: dim,
                    columns: columns,
                    valueByEntity: finalValueByEntity
                }
            })
    }

    @computed get displayDimensions(): DataTableDimension[] {
        return this.dimensionsWithValues.map(d => ({
            key: d.dimension.variableId,
            name: d.dimension.displayName || d.dimension.variable.name || "",
            unit: getHeaderUnit(d.dimension.unit),
            // A top-level header is only sortable if it has a single nested column, because
            // in that case the nested column is not rendered.
            sortable: d.columns.length === 1,
            columns: d.columns.map(column => ({
                ...column,
                // All columns are sortable for now, but in the future we will have a sparkline that
                // is not sortable.
                sortable: true
            })),
            formatYear: d.dimension.formatYear
        }))
    }

    @computed get displayRows(): DataTableRow[] {
        const entities = this.chart.data.availableEntities
        const rows = entities.map(entity => {
            const dimensionValues = this.dimensionsWithValues.map(d =>
                d.valueByEntity.get(entity)
            )
            return {
                entity,
                dimensionValues
            }
        })
        return rows
    }
}
