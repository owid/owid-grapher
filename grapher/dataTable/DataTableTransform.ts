import { computed } from "mobx"
import {
    valuesByEntityAtTimes,
    es6mapValues,
    valuesByEntityWithinTimes,
    getStartEndValues,
    intersection,
    flatten,
    sortBy,
    countBy,
    union,
} from "grapher/utils/Util"
import { Grapher } from "grapher/core/Grapher"
import { ChartDimension } from "grapher/chart/ChartDimension"
import { TickFormattingOptions, Time } from "grapher/core/GrapherConstants"
import {
    getTimeWithinTimeRange,
    isUnboundedLeft,
    TimeBoundValue,
} from "grapher/utils/TimeBounds"
import { ChartTransform } from "grapher/chart/ChartTransform"

export enum TargetTimeMode {
    point = "point",
    range = "range",
}

interface Dimension {
    dimension: ChartDimension
    columns: DimensionColumn[]
    valueByEntity: Map<string, DimensionValue>
}

interface DimensionColumn {
    key: SingleValueKey | RangeValueKey
    targetTime?: Time
    targetTimeMode?: TargetTimeMode
}

export interface Value {
    value?: string | number
    formattedValue?: string
    time?: Time
}

// range (two point values)
export enum RangeValueKey {
    start = "start",
    end = "end",
    delta = "delta",
    deltaRatio = "deltaRatio",
}

type RangeValue = Record<RangeValueKey, Value | undefined>

export function isRangeValue(value: DimensionValue): value is RangeValue {
    return "start" in value
}

// single point values
export enum SingleValueKey {
    single = "single",
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
    formatTime: (num: Time, options?: { format?: string }) => string
}

export type DataTableColumn = DimensionColumn & Sortable
export interface DataTableRow {
    entity: string
    dimensionValues: (DimensionValue | undefined)[] // TODO make it not undefined
}

// Utilities
const getHeaderUnit = (unit: string) => (unit !== "%" ? unit : "percent")

export class DataTableTransform extends ChartTransform {
    grapher: Grapher

    constructor(grapher: Grapher) {
        super(grapher)
        this.grapher = grapher
    }

    @computed private get loadedWithData(): boolean {
        return this.dimensions.length > 0
    }

    private readonly AUTO_SELECTION_THRESHOLD_PERCENTAGE: number = 0.5

    /**
     * If the user or the editor hasn't specified a start, auto-select a start time
     *  where AUTO_SELECTION_THRESHOLD_PERCENTAGE of the entities have values.
     */
    @computed get autoSelectedStartTime(): number | undefined {
        let autoSelectedStartTime: number | undefined = undefined

        if (
            this.grapher.userHasSetTimeline ||
            this.initialTimelineStartTimeSpecified ||
            !this.loadedWithData
        )
            return undefined

        const numEntitiesInTable = this.entities.length

        this.dimensions.forEach((dim) => {
            const numberOfEntitiesWithDataSortedByTime = sortBy(
                Object.entries(countBy(dim.times)),
                (value) => parseInt(value[0])
            )

            const firstTimeWithSufficientData = numberOfEntitiesWithDataSortedByTime.find(
                (time) => {
                    const numEntitiesWithData = time[1]
                    const percentEntitiesWithData =
                        numEntitiesWithData / numEntitiesInTable
                    return (
                        percentEntitiesWithData >=
                        this.AUTO_SELECTION_THRESHOLD_PERCENTAGE
                    )
                }
            )?.[0]

            if (firstTimeWithSufficientData) {
                autoSelectedStartTime = parseInt(firstTimeWithSufficientData)
                return false
            }
            return true
        })

        return autoSelectedStartTime
    }

    @computed get availableTimes() {
        return intersection(
            flatten(this.dimensions.map((dim) => dim.timesUniq))
        )
    }

    @computed get dimensions() {
        return this.grapher.multiMetricTableMode
            ? this.grapher.dataTableOnlyDimensions
            : this.grapher.filledDimensions.filter((dim) => dim.includeInTable)
    }

    @computed get entities() {
        return union(...this.dimensions.map((dim) => dim.entityNamesUniq))
    }

    // TODO move this logic to chart
    @computed get targetTimeMode(): TargetTimeMode {
        const { grapher } = this
        if (
            (grapher.isLineChart && !grapher.lineChartTransform.isSingleTime) ||
            grapher.isStackedArea ||
            grapher.isStackedBar ||
            (grapher.isScatter &&
                !grapher.scatterTransform.compareEndPointsOnly)
        )
            return TargetTimeMode.range

        return TargetTimeMode.point
    }

    @computed get initialTimelineStartTimeSpecified(): boolean {
        const initialMinTime = this.grapher.configOnLoad.minTime
        if (initialMinTime) return !isUnboundedLeft(initialMinTime)
        return false
    }

    @computed get targetTimes(): [Time] | [Time, Time] {
        // legacy support for Exemplars Explorer project
        const grapher = this.grapher
        if (grapher.currentTab === "map")
            return [
                getTimeWithinTimeRange(
                    [grapher.startTime, grapher.endTime],
                    grapher.map.time ?? TimeBoundValue.unboundedRight
                ),
            ]

        return this.startTimelineTime === this.endTimelineTime
            ? [this.startTimelineTime]
            : [this.startTimelineTime, this.endTimelineTime]
    }

    formatValue(
        dimension: ChartDimension,
        value: number | string | undefined,
        formattingOverrides?: TickFormattingOptions
    ): string | undefined {
        if (value === undefined) return value
        return dimension.formatValueShortFn(value, {
            numberPrefixes: false,
            noTrailingZeroes: false,
            unit: dimension.shortUnit,
            ...formattingOverrides,
        })
    }

    @computed get dimensionsWithValues(): Dimension[] {
        return this.dimensions.map((dimension) => {
            const targetTimes =
                // If a targetTime override is specified on the dimension (scatter plots
                // can do this) then use that target time and ignore the timeline.
                dimension.targetYear !== undefined && this.grapher.isScatter
                    ? [dimension.targetYear]
                    : this.targetTimes

            const targetTimeMode =
                targetTimes.length < 2
                    ? TargetTimeMode.point
                    : this.targetTimeMode

            const prelimValuesByEntity =
                targetTimeMode === TargetTimeMode.range
                    ? // In the "range" mode, we receive all data values within the range. But we
                      // only want to plot the start & end values in the table.
                      // getStartEndValues() extracts these two values.
                      es6mapValues(
                          valuesByEntityWithinTimes(
                              dimension.valueByEntityAndTime,
                              targetTimes
                          ),
                          getStartEndValues
                      )
                    : valuesByEntityAtTimes(
                          dimension.valueByEntityAndTime,
                          targetTimes,
                          dimension.tolerance
                      )

            const isRange = targetTimes.length === 2

            // Inject delta columns if we have start & end values to compare in the table.
            // One column for absolute difference, another for % difference.
            const deltaColumns: DimensionColumn[] = []
            if (isRange) {
                const { tableDisplay } = dimension.display
                if (!tableDisplay?.hideAbsoluteChange)
                    deltaColumns.push({ key: RangeValueKey.delta })
                if (!tableDisplay?.hideRelativeChange)
                    deltaColumns.push({ key: RangeValueKey.deltaRatio })
            }

            const columns: DimensionColumn[] = [
                ...targetTimes.map((targetTime, index) => ({
                    key: isRange
                        ? index === 0
                            ? RangeValueKey.start
                            : RangeValueKey.end
                        : SingleValueKey.single,
                    targetTime,
                    targetTimeMode,
                })),
                ...deltaColumns,
            ]

            const valueByEntity = es6mapValues(prelimValuesByEntity, (dvs) => {
                // There is always a column, but not always a data value (in the delta column the
                // value needs to be calculated)
                if (isRange) {
                    const [start, end]: (Value | undefined)[] = dvs
                    const result: RangeValue = {
                        start: {
                            ...start,
                            formattedValue: this.formatValue(
                                dimension,
                                start?.value
                            ),
                        },
                        end: {
                            ...end,
                            formattedValue: this.formatValue(
                                dimension,
                                end?.value
                            ),
                        },
                        delta: undefined,
                        deltaRatio: undefined,
                    }

                    if (
                        start !== undefined &&
                        end !== undefined &&
                        typeof start.value === "number" &&
                        typeof end.value === "number"
                    ) {
                        const deltaValue = end.value - start.value
                        const deltaRatioValue =
                            deltaValue / Math.abs(start.value)

                        result.delta = {
                            value: deltaValue,
                            formattedValue: this.formatValue(
                                dimension,
                                deltaValue,
                                {
                                    showPlus: true,
                                    unit:
                                        dimension.shortUnit === "%"
                                            ? "pp"
                                            : dimension.shortUnit,
                                }
                            ),
                        }

                        result.deltaRatio = {
                            value: deltaRatioValue,
                            formattedValue:
                                isFinite(deltaRatioValue) &&
                                !isNaN(deltaRatioValue)
                                    ? this.formatValue(
                                          dimension,
                                          deltaRatioValue * 100,
                                          {
                                              unit: "%",
                                              numDecimalPlaces: 0,
                                              showPlus: true,
                                          }
                                      )
                                    : undefined,
                        }
                    }
                    return result
                } else {
                    // if single time
                    const dv = dvs[0]
                    const result: SingleValue = {
                        single: { ...dv },
                    }
                    if (dv !== undefined)
                        result.single!.formattedValue = this.formatValue(
                            dimension,
                            dv.value
                        )
                    return result
                }
            })

            return {
                dimension,
                columns,
                valueByEntity,
            }
        })
    }

    @computed get displayDimensions(): DataTableDimension[] {
        return this.dimensionsWithValues.map((d) => ({
            key: d.dimension.variableId,
            name: d.dimension.displayName || d.dimension.column.name || "",
            unit: getHeaderUnit(d.dimension.unit),
            // A top-level header is only sortable if it has a single nested column, because
            // in that case the nested column is not rendered.
            sortable: d.columns.length === 1,
            columns: d.columns.map((column) => ({
                ...column,
                // All columns are sortable for now, but in the future we will have a sparkline that
                // is not sortable.
                sortable: true,
            })),
            formatTime: d.dimension.formatTimeFn,
        }))
    }

    @computed get displayRows(): DataTableRow[] {
        const rows = this.entities.map((entity) => {
            const dimensionValues = this.dimensionsWithValues.map((d) =>
                d.valueByEntity.get(entity)
            )
            return {
                entity,
                dimensionValues,
            }
        })
        return rows
    }
}
