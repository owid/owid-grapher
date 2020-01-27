import { computed } from "mobx"

import {
    sortBy,
    valuesByEntityAtYears,
    es6mapValues,
    flatten,
    valuesByEntityWithinYears,
    getStartEndValues,
    zip
} from "./Util"
import { ChartConfig } from "./ChartConfig"
import { DimensionWithData } from "./DimensionWithData"

// Target year modes

type TargetYearMode = "point" | "range"

export class TargetYearModes {
    static point: TargetYearMode = "point"
    static range: TargetYearMode = "range"
}

type TargetYears = [number] | [number, number]

// Column types

export type ColumnType = "point" | "start" | "end" | "delta" | "deltaRatio"

export class ColumnTypes {
    static point: ColumnType = "point"
    static start: ColumnType = "start"
    static end: ColumnType = "end"
    static delta: ColumnType = "delta"
    static deltaRatio: ColumnType = "deltaRatio"
}

// Dimensions

export interface Dimension {
    dimension: DimensionWithData
    columns: DimensionColumn[]
    valuesByEntity: Map<string, (DimensionValue | undefined)[]>
}

export interface DimensionColumn {
    type: ColumnType
    targetYear?: number
    targetYearMode?: TargetYearMode
}

export interface DimensionValue {
    value?: string | number
    formattedValue?: string
    year?: number
}

// Data table types

export interface DataTableHeader {
    key: number
    name: string
    unit?: string
    subheaders: DimensionColumn[]
}

export interface DataTableRow {
    entity: string
    values: DataTableValue[]
}

export type DataTableColumn = DimensionColumn

export interface DataTableValue {
    key: string
    value?: string | number
    formattedValue?: string
    year?: number
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

    @computed get dimensionHeaders(): DataTableHeader[] {
        return this.dimensionsWithValues.map(d => ({
            key: d.dimension.variableId,
            name: d.dimension.displayName,
            unit: getHeaderUnit(d.dimension.unit),
            subheaders: d.columns
        }))
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
                          { type: ColumnTypes.delta },
                          { type: ColumnTypes.deltaRatio }
                      ]
                    : []

            const columns: DimensionColumn[] = [
                ...targetYears.map((targetYear, index) => ({
                    type:
                        targetYearMode === TargetYearModes.range
                            ? index === 0
                                ? ColumnTypes.start
                                : ColumnTypes.end
                            : ColumnTypes.point,
                    targetYear,
                    targetYearMode
                })),
                ...deltaColumns
            ]

            function format(
                value: number | string | undefined,
                unit?: string
            ): string | undefined {
                if (value === undefined) return value
                return dim.formatValueShort(value, {
                    autoPrefix: false,
                    noTrailingZeroes: false,
                    unit: unit !== undefined ? unit : getValueUnit(dim.unit)
                })
            }

            const finalValuesByEntity = es6mapValues(valuesByEntity, dvs => {
                // There is always a column, but not always a data value (in the delta column the
                // value needs to be calculated)
                return zip(columns, dvs).map(([column, dv]) => {
                    if (
                        column &&
                        (column.type === ColumnTypes.delta ||
                            column.type === ColumnTypes.deltaRatio)
                    ) {
                        const [start, end] = dvs
                        const isRatio = column.type === ColumnTypes.deltaRatio
                        if (
                            start !== undefined &&
                            end !== undefined &&
                            typeof start.value === "number" &&
                            typeof end.value === "number"
                        ) {
                            const value = isRatio
                                ? (end.value - start.value) / start.value
                                : end.value - start.value
                            return {
                                ...dv,
                                value,
                                formattedValue: isRatio
                                    ? format(value * 100, "%")
                                    : format(value)
                            }
                        } else {
                            return dv
                        }
                    } else {
                        return {
                            ...dv,
                            formattedValue: format(dv?.value)
                        }
                    }
                })
            })

            return {
                dimension: dim,
                columns: columns,
                valuesByEntity: finalValuesByEntity
            }
        })
    }

    @computed get displayColumns(): DataTableColumn[] {
        return flatten(this.dimensionsWithValues.map(d => d.columns))
    }

    @computed get displayRows(): DataTableRow[] {
        const entities = sortBy(this.chart.data.availableEntities)
        return entities.map(entity => {
            const values = flatten(
                this.dimensionsWithValues.map(d => {
                    const values = d.valuesByEntity.get(entity) || []
                    return values.map((v, index) => ({
                        ...v,
                        key: `${d.dimension.variableId}-${index}`
                    }))
                })
            )
            return {
                entity,
                values
            }
        })
    }
}
