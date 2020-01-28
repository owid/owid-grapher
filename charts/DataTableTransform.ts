import { computed } from "mobx"

import {
    valuesByEntityAtYears,
    es6mapValues,
    valuesByEntityWithinYears,
    getStartEndValues,
    orderBy
} from "./Util"
import { ChartConfig } from "./ChartConfig"
import { DimensionWithData } from "./DimensionWithData"
import { TickFormattingOptions } from "./TickFormattingOptions"
import { DataTableState } from "./DataTable"

// Target year modes

type TargetYearMode = "point" | "range"

export class TargetYearModes {
    static point: TargetYearMode = "point"
    static range: TargetYearMode = "range"
}

type TargetYears = [number] | [number, number]

// Column types

export type CompositeValueKey = "start" | "end" | "delta" | "deltaRatio"

export type ColumnKey = "value" | CompositeValueKey

export class ColumnKeys {
    static value: ColumnKey = "value"
    static start: ColumnKey = "start"
    static end: ColumnKey = "end"
    static delta: ColumnKey = "delta"
    static deltaRatio: ColumnKey = "deltaRatio"
}

// Sorting modes

export type SortOrder = "asc" | "desc"

export class SortOrders {
    static asc: SortOrder = "asc"
    static desc: SortOrder = "desc"
}

export interface Sortable {
    sortable: boolean
    sorted?: SortOrder
}
// onSort?: (sort: SortOrder | undefined) => void

// Dimensions

export interface Dimension {
    dimension: DimensionWithData
    columns: DimensionColumn[]
    valueByEntity: Map<string, DimensionValue>
}

export interface DimensionColumn {
    type: ColumnKey
    targetYear?: number
    targetYearMode?: TargetYearMode
}

// export interface DimensionValue {
//     value?: string | number
//     formattedValue?: string
//     year?: number
// }

export interface SingleValue {
    value?: string | number
    formattedValue?: string
    year?: number
}

type CompositeValue = Record<CompositeValueKey, SingleValue | undefined>

export type DimensionValue = SingleValue | CompositeValue

// Data table types

export interface DataTableDimension extends Sortable {
    key: number
    name: string
    unit?: string
    columns: DataTableColumn[]
}

export type DataTableColumn = DimensionColumn & Sortable

export interface DataTableRow {
    entity: string
    dimensionValues: (DimensionValue | undefined)[]
}

// Utilities

function getHeaderUnit(unit: string) {
    return unit !== "%" ? unit : "percent"
}

function getValueUnit(unit: string) {
    return unit !== "%" ? undefined : unit
}

export function isSingleValue(value: DimensionValue): value is SingleValue {
    return !("start" in value)
}

export function isCompositeValue(
    value: DimensionValue
): value is CompositeValue {
    return "start" in value
}

export class DataTableTransform {
    chart: ChartConfig
    state: DataTableState

    constructor(chart: ChartConfig, state: DataTableState) {
        this.chart = chart
        this.state = state
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
                return TargetYearModes.range
            }
            if (
                this.chart.isScatter &&
                !this.chart.scatter.compareEndPointsOnly
            ) {
                return TargetYearModes.range
            }
        }
        return TargetYearModes.point
    }

    // TODO move this logic to chart
    @computed get targetYears(): TargetYears {
        const mapTarget = this.chart.map.props.targetYear
        const { timeDomain } = this.chart
        if (this.chart.tab === "map" && mapTarget !== undefined) {
            return [mapTarget]
        } else if (timeDomain[0] !== undefined && timeDomain[1] !== undefined) {
            if (timeDomain[0] === timeDomain[1]) return [timeDomain[0]]
            else return [timeDomain[0], timeDomain[1]]
        } else {
            return [new Date().getFullYear()]
        }
    }

    formatValue(
        dimension: DimensionWithData,
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
        return this.dimensions.map(dim => {
            const targetYears =
                // If a targetYear override is specified on the dimension (scatter plots
                // can do this) then use that target year and ignore the timeline.
                dim.targetYear !== undefined
                    ? [dim.targetYear]
                    : this.targetYears

            const targetYearMode =
                targetYears.length < 2
                    ? TargetYearModes.point
                    : this.targetYearMode

            const valuesByEntity =
                targetYearMode === TargetYearModes.range
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
                    : // In the "point" mode, we don't need to worry about
                      valuesByEntityAtYears(
                          dim.valueByEntityAndYear,
                          targetYears,
                          dim.tolerance
                      )

            // Inject delta columns if we have start & end values to compare in the table.
            // One column for absolute difference, another for % difference.
            const deltaColumns: DimensionColumn[] =
                targetYears.length === 2
                    ? [
                          { type: ColumnKeys.delta },
                          { type: ColumnKeys.deltaRatio }
                      ]
                    : []

            const columns: DimensionColumn[] = [
                ...targetYears.map((targetYear, index) => ({
                    type:
                        targetYears.length === 2
                            ? index === 0
                                ? ColumnKeys.start
                                : ColumnKeys.end
                            : ColumnKeys.value,
                    targetYear,
                    targetYearMode
                })),
                ...deltaColumns
            ]

            const finalValueByEntity = es6mapValues(valuesByEntity, dvs => {
                // There is always a column, but not always a data value (in the delta column the
                // value needs to be calculated)
                if (targetYears.length === 2) {
                    const [start, end]: (SingleValue | undefined)[] = dvs
                    const result: CompositeValue = {
                        start: {
                            ...start,
                            formattedValue: this.formatValue(dim, start?.value)
                        },
                        end: {
                            ...end,
                            formattedValue: this.formatValue(dim, end?.value)
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
                            formattedValue: this.formatValue(dim, deltaValue, {
                                showPlus: true
                            })
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
                    const dv = dvs[0]
                    if (dv !== undefined) {
                        return {
                            ...dv,
                            formattedValue: this.formatValue(dim, dv.value)
                        }
                    }
                    return {}
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
        return this.dimensionsWithValues.map((d, dimIndex) => ({
            key: d.dimension.variableId,
            name: d.dimension.displayName,
            unit: getHeaderUnit(d.dimension.unit),
            sortable: d.columns.length === 1,
            sorted:
                d.columns.length === 1 && this.state.sort.dimension === dimIndex
                    ? this.state.sort.order
                    : undefined,
            columns: d.columns.map(column => ({
                ...column,
                sortable: true,
                sorted:
                    this.state.sort.dimension === dimIndex &&
                    this.state.sort.dimensionColumn === column.type
                        ? this.state.sort.order
                        : undefined
            }))
        }))
    }

    @computed get sortFunction(): (
        row: DataTableRow
    ) => number | string | undefined {
        if (this.state.sort.dimension === "entity") {
            return row => row.entity
        }
        return row => {
            const dimIndex = this.state.sort.dimension as number
            const dv = row.dimensionValues[dimIndex] as DimensionValue

            let value: number | string | undefined

            if (isSingleValue(dv)) {
                value = dv.value
            } else if (isCompositeValue(dv)) {
                const column = this.state.sort
                    .dimensionColumn as CompositeValueKey
                value = dv[column]?.value
            }

            // We always want undefined values to be last
            if (
                value === undefined ||
                (typeof value === "number" &&
                    (!isFinite(value) || isNaN(value)))
            ) {
                return this.state.sort.order === SortOrders.asc
                    ? Infinity
                    : -Infinity
            }

            return value
        }
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
        return orderBy(rows, this.sortFunction, [this.state.sort.order])
    }
}
