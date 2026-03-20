import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import {
    DumbbellChartManager,
    DumbbellSeries,
    DumbbellMode,
} from "./DumbbellChartConstants"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { FocusArray } from "../focus/FocusArray"
import {
    ColumnSlug,
    ScaleType,
    SeriesStrategy,
    FacetStrategy,
    ColorSchemeName,
    ChartErrorInfo,
    SortBy,
    SortConfig,
} from "@ourworldindata/types"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getShortNameForEntity,
    makeSelectionArray,
    sortByConfig,
} from "../chart/ChartUtils"
import {
    AnnotationsMap,
    getAnnotationsMap,
    getAnnotationsForSeries,
} from "../lineCharts/LineChartHelpers"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"

import { domainExtent } from "@ourworldindata/utils"

export class DumbbellChartState implements ChartState {
    manager: DumbbellChartManager

    defaultBaseColorScheme = ColorSchemeName.OwidDistinctLines

    constructor({ manager }: { manager: DumbbellChartManager }) {
        this.manager = manager
        makeObservable(this)
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        return table
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get focusArray(): FocusArray {
        return this.manager.focusArray ?? new FocusArray()
    }

    @computed get yColumnSlugs(): ColumnSlug[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed get isLogScale(): boolean {
        return this.manager.yAxisConfig?.scaleType === ScaleType.log
    }

    @computed get yScaleType(): ScaleType {
        return this.manager.yAxisConfig?.scaleType ?? ScaleType.linear
    }

    @computed get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : null) ?? ColorSchemes.get(this.defaultBaseColorScheme)
        )
    }

    /** In two-column mode, assign one color per indicator column */
    @computed private get columnColors(): [string, string] {
        const scheme = this.colorScheme
        const colors = scheme.getColors(2)
        return [colors[0], colors[1]]
    }

    static readonly POSITIVE_CHANGE_COLOR = "#2d8587"
    static readonly NEGATIVE_CHANGE_COLOR = "#c25a5a"
    static readonly CONNECTOR_COLOR = "#ccc"

    @computed get startTime(): number {
        return this.transformedTable.minTime ?? 0
    }

    @computed get endTime(): number {
        return this.transformedTable.maxTime ?? 0
    }

    /**
     * Determines the dumbbell mode based on the number of Y columns:
     * - "two-column": two or more Y columns, each entity gets start=col[0], end=col[1] at a single time
     * - "time-range": one Y column, each entity gets start=value at startTime, end=value at endTime
     */
    @computed get mode(): DumbbellMode {
        return this.yColumnSlugs.length >= 2 ? "two-column" : "time-range"
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        return [FacetStrategy.none]
    }

    @computed get annotationsMap(): AnnotationsMap | undefined {
        return getAnnotationsMap(this.inputTable, this.yColumnSlugs[0])
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    private constructSeriesForTimeRange(): DumbbellSeries[] {
        const { startTime, endTime, focusArray, annotationsMap } = this
        const column = this.yColumns[0]
        const columnSlug = this.yColumnSlugs[0]
        const owidRowByTime = column.owidRowByEntityNameAndTime

        const allSeries: DumbbellSeries[] = []

        for (const entityName of this.selectionArray.selectedEntityNames) {
            const rowsByTime = owidRowByTime.get(entityName)
            const startRow = rowsByTime?.get(startTime)
            const endRow = rowsByTime?.get(endTime)
            const shortName = getShortNameForEntity(entityName)

            if (startRow?.value === undefined || endRow?.value === undefined) {
                if (rowsByTime) {
                    allSeries.push({
                        missing: true,
                        seriesName: entityName,
                        entityName,
                        displayName: shortName ?? entityName,
                        shortEntityName: shortName,
                        color: "#ccc",
                    })
                }
                continue
            }

            const startValue = startRow.value as number
            const endValue = endRow.value as number
            const directionColor =
                endValue >= startValue
                    ? DumbbellChartState.POSITIVE_CHANGE_COLOR
                    : DumbbellChartState.NEGATIVE_CHANGE_COLOR

            allSeries.push({
                missing: false,
                seriesName: entityName,
                entityName,
                displayName: shortName ?? entityName,
                shortEntityName: shortName,
                annotation: getAnnotationsForSeries(annotationsMap, entityName),
                color: directionColor,
                startColor: directionColor,
                endColor: directionColor,
                connectorColor: directionColor,
                start: {
                    value: startValue,
                    time: startRow.originalTime,
                    columnSlug,
                },
                end: {
                    value: endValue,
                    time: endRow.originalTime,
                    columnSlug,
                },
                focus: focusArray.state(entityName),
            })
        }

        return allSeries
    }

    private constructSeriesForTwoColumns(): DumbbellSeries[] {
        const { endTime, focusArray, annotationsMap, columnColors } = this
        const [colA, colB] = this.yColumns
        const [slugA, slugB] = this.yColumnSlugs
        const owidRowByTimeA = colA.owidRowByEntityNameAndTime
        const owidRowByTimeB = colB.owidRowByEntityNameAndTime
        const [startColor, endColor] = columnColors

        const allSeries: DumbbellSeries[] = []

        for (const entityName of this.selectionArray.selectedEntityNames) {
            const rowsByTimeA = owidRowByTimeA.get(entityName)
            const rowsByTimeB = owidRowByTimeB.get(entityName)

            const rowA = rowsByTimeA?.get(endTime)
            const rowB = rowsByTimeB?.get(endTime)
            const shortName = getShortNameForEntity(entityName)

            if (rowA?.value === undefined || rowB?.value === undefined) {
                if (rowsByTimeA || rowsByTimeB) {
                    allSeries.push({
                        missing: true,
                        seriesName: entityName,
                        entityName,
                        displayName: shortName ?? entityName,
                        shortEntityName: shortName,
                        color: "#ccc",
                    })
                }
                continue
            }

            allSeries.push({
                missing: false,
                seriesName: entityName,
                entityName,
                displayName: shortName ?? entityName,
                shortEntityName: shortName,
                annotation: getAnnotationsForSeries(annotationsMap, entityName),
                color: startColor,
                startColor,
                endColor,
                connectorColor: DumbbellChartState.CONNECTOR_COLOR,
                start: {
                    value: rowA.value as number,
                    time: rowA.originalTime,
                    columnSlug: slugA,
                },
                end: {
                    value: rowB.value as number,
                    time: rowB.originalTime,
                    columnSlug: slugB,
                },
                focus: focusArray.state(entityName),
            })
        }

        return allSeries
    }

    @computed private get unsortedAllSeries(): DumbbellSeries[] {
        return this.mode === "time-range"
            ? this.constructSeriesForTimeRange()
            : this.constructSeriesForTwoColumns()
    }

    /** Unified list of all series (data + missing), with data series sorted
     *  according to sortConfig and missing series appended at the end. */
    @computed get allSeries(): DumbbellSeries[] {
        const dataSeries = this.unsortedAllSeries.filter((s) => !s.missing)
        const missingSeries = this.unsortedAllSeries.filter((s) => s.missing)

        const sortedDataSeries = sortByConfig(dataSeries, this.sortConfig, {
            [SortBy.custom]: (item): number =>
                this.selectionArray.selectedEntityNames.indexOf(
                    item.entityName
                ),
            [SortBy.entityName]: (item): string => item.seriesName,
            [SortBy.total]: (item): number => item.end!.value,
            [SortBy.column]: (item): number => item.end!.value,
        })

        return [...sortedDataSeries, ...missingSeries]
    }

    /** ChartState.series — only the non-missing series */
    @computed get series(): DumbbellSeries[] {
        return this.allSeries.filter((s) => !s.missing)
    }

    @computed get allYValues(): number[] {
        return this.series.flatMap((series) => [
            series.start!.value,
            series.end!.value,
        ])
    }

    @computed get yDomainDefault(): [number, number] {
        const defaultDomain: [number, number] = [Infinity, -Infinity]
        return domainExtent(this.allYValues, this.yScaleType) ?? defaultDomain
    }

    @computed get errorInfo(): ChartErrorInfo {
        const message = getDefaultFailMessage(this.manager)
        if (message) return { reason: message }

        const { entityTypePlural = "entities" } = this.manager
        if (this.series.length === 0)
            return {
                reason: `No data for the selected ${entityTypePlural}`,
            }
        return { reason: "" }
    }
}
