import { computed } from "mobx"

import {
    valuesByEntityAtYears,
    es6mapValues,
    valuesByEntityWithinYears,
    getStartEndValues,
    intersection,
    flatten,
    sortBy,
    countBy,
    union
} from "charts/utils/Util"
import { Grapher } from "charts/core/Grapher"
import { ChartDimension } from "charts/chart/ChartDimension"
import { TickFormattingOptions } from "charts/core/GrapherConstants"
import {
    getTimeWithinTimeRange,
    isUnboundedLeft
} from "charts/utils/TimeBounds"
import { ChartTransform } from "charts/chart/ChartTransform"

// Target year modes

export enum TargetYearMode {
    point = "point",
    range = "range"
}

type TargetYears = [number] | [number, number]

// Dimensions

interface Dimension {
    dimension: ChartDimension
    columns: DimensionColumn[]
    valueByEntity: Map<string, DimensionValue>
}

interface DimensionColumn {
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

type RangeValue = Record<RangeValueKey, Value | undefined>

export function isRangeValue(value: DimensionValue): value is RangeValue {
    return "start" in value
}

// single point values

export enum SingleValueKey {
    single = "single"
}

type SingleValue = Record<SingleValueKey, Value | undefined>

export function isSingleValue(value: DimensionValue): value is SingleValue {
    return "single" in value
}

// combined types

export type DimensionValue = SingleValue | RangeValue

export type ColumnKey = SingleValueKey | RangeValueKey

// Data table types

interface Sortable {
    sortable: boolean
}

export interface DataTableDimension extends Sortable {
    key: number
    name: string
    unit?: string
    columns: DataTableColumn[]
    formatYear: (num: number, options?: { format?: string }) => string
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

export class DataTableTransform extends ChartTransform {
    chart: Grapher

    constructor(chart: Grapher) {
        super(chart)
        this.chart = chart
    }

    @computed private get loadedWithData(): boolean {
        return this.dimensions.length > 0
    }

    private readonly AUTO_SELECTION_THRESHOLD_PERCENTAGE: number = 0.5

    /**
     * If the user or the editor hasn't specified a start, auto-select a start year
     *  where AUTO_SELECTION_THRESHOLD_PERCENTAGE of the entities have values.
     */
    @computed get autoSelectedStartYear(): number | undefined {
        let autoSelectedStartYear: number | undefined = undefined

        if (
            this.chart.userHasSetTimeline ||
            this.initialTimelineStartYearSpecified ||
            !this.loadedWithData
        )
            return undefined

        const numEntitiesInTable = this.entities.length

        this.dimensions.forEach(dim => {
            const numberOfEntitiesWithDataSortedByYear = sortBy(
                Object.entries(countBy(dim.years)),
                value => parseInt(value[0])
            )

            const firstYearWithSufficientData = numberOfEntitiesWithDataSortedByYear.find(
                year => {
                    const numEntitiesWithData = year[1]
                    const percentEntitiesWithData =
                        numEntitiesWithData / numEntitiesInTable
                    return (
                        percentEntitiesWithData >=
                        this.AUTO_SELECTION_THRESHOLD_PERCENTAGE
                    )
                }
            )?.[0]

            if (firstYearWithSufficientData) {
                autoSelectedStartYear = parseInt(firstYearWithSufficientData)
                return false
            }
            return true
        })

        return autoSelectedStartYear
    }

    @computed get isValidConfig(): boolean {
        return true
    }

    @computed get availableYears() {
        return intersection(flatten(this.dimensions.map(dim => dim.yearsUniq)))
    }

    @computed get dimensions() {
        return this.chart.multiMetricTableMode
            ? this.chart.dataTableOnlyDimensions
            : this.chart.filledDimensions.filter(dim => dim.includeInTable)
    }

    @computed get entities() {
        return union(...this.dimensions.map(dim => dim.entityNamesUniq))
    }

    // TODO move this logic to chart
    @computed get targetYearMode(): TargetYearMode {
        const { tab } = this.chart
        if (tab === "chart") {
            if (this.chart.multiMetricTableMode) return TargetYearMode.point
            if (
                (this.chart.isLineChart &&
                    !this.chart.lineChartTransform.isSingleYear) ||
                this.chart.isStackedArea ||
                this.chart.isStackedBar
            ) {
                return TargetYearMode.range
            }
            if (
                this.chart.isScatter &&
                !this.chart.scatterTransform.compareEndPointsOnly
            ) {
                return TargetYearMode.range
            }
        }
        return TargetYearMode.point
    }

    @computed get initialTimelineStartYearSpecified(): boolean {
        const initialMinTime = this.chart.initialScript.minTime
        if (initialMinTime) return !isUnboundedLeft(initialMinTime)
        return false
    }

    @computed get targetYears(): TargetYears {
        // legacy support for Exemplars Explorer project
        if (this.chart.tab === "map")
            return [
                getTimeWithinTimeRange(
                    [this.chart.minYear, this.chart.maxYear],
                    this.chart.mapTransform.targetYearProp
                )
            ]

        return this.startYear === this.endYear
            ? [this.startYear]
            : [this.startYear, this.endYear]
    }

    formatValue(
        dimension: ChartDimension,
        value: number | string | undefined,
        formattingOverrides?: TickFormattingOptions
    ): string | undefined {
        if (value === undefined) return value
        return dimension.formatValueShort(value, {
            numberPrefixes: false,
            noTrailingZeroes: false,
            unit: dimension.shortUnit,
            ...formattingOverrides
        })
    }

    @computed get dimensionsWithValues(): Dimension[] {
        return this.dimensions.map(dim => {
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
            const deltaColumns: DimensionColumn[] = []
            if (isRange) {
                const { tableDisplay } = dim.spec.display
                if (!tableDisplay?.hideAbsoluteChange)
                    deltaColumns.push({ key: RangeValueKey.delta })
                if (!tableDisplay?.hideRelativeChange)
                    deltaColumns.push({ key: RangeValueKey.deltaRatio })
            }

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
                                showPlus: true,
                                unit:
                                    dim.shortUnit === "%" ? "pp" : dim.shortUnit
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
            name: d.dimension.displayName || d.dimension.column.name || "",
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
        const rows = this.entities.map(entity => {
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
