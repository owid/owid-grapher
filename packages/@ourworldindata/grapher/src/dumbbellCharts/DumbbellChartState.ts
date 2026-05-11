import { computed, makeObservable } from "mobx"
import {
    ColumnSlug,
    DumbbellConnectorStyle,
    ScaleType,
    SeriesStrategy,
    FacetStrategy,
    ChartErrorInfo,
    SortBy,
    SortConfig,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { domainExtent } from "@ourworldindata/utils"
import { ChartState } from "../chart/ChartInterface"
import {
    DECREASE_COLOR,
    DumbbellChartManager,
    DumbbellHead,
    DumbbellSeries,
    END_COLUMN_COLOR,
    INCREASE_COLOR,
    NO_CHANGE_COLOR,
    START_COLUMN_COLOR,
} from "./DumbbellChartConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { FocusArray } from "../focus/FocusArray"
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

export class DumbbellChartState implements ChartState {
    manager: DumbbellChartManager

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

        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

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

    @computed get yColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed get startTime(): number {
        return this.transformedTable.minTime ?? 0
    }

    @computed get endTime(): number {
        return this.transformedTable.maxTime ?? 0
    }

    /**
     * Determines how dumbbell series are constructed:
     * - entity: compares the same column's values across two time points
     * - column: compares two different columns' values at a single time point
     * */
    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager)
    }

    @computed get connectorStyle(): DumbbellConnectorStyle {
        return (
            this.manager.dumbbell?.connectorStyle ??
            DumbbellConnectorStyle.Arrow
        )
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        return [FacetStrategy.none]
    }

    @computed private get annotationsMap(): AnnotationsMap | undefined {
        return getAnnotationsMap(this.inputTable, this.yColumnSlugs[0])
    }

    @computed private get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed private get sortColumn(): CoreColumn | undefined {
        const sortColumnSlug = this.sortConfig.sortColumnSlug
        if (!sortColumnSlug) return undefined

        const sortColumn = this.transformedTable.get(sortColumnSlug)
        if (sortColumn && !sortColumn.isMissing) return sortColumn

        return undefined
    }

    /** Constructs series by comparing the same column's values across two time points */
    private constructSeriesForTimeRange(): DumbbellSeries[] {
        const { yColumn, startTime, endTime, focusArray, annotationsMap } = this

        return this.selectionArray.selectedEntityNames
            .map((entityName): DumbbellSeries | undefined => {
                const rowsByTime =
                    yColumn.owidRowByEntityNameAndTime.get(entityName)

                const startRow = rowsByTime?.get(startTime)
                const endRow = rowsByTime?.get(endTime)

                // We can't plot a dumbbell if either the start or end value is missing or non-numeric
                if (
                    typeof startRow?.value !== "number" ||
                    typeof endRow?.value !== "number"
                )
                    return undefined

                // The color of the dumbbell is determined by whether
                // the value has increased or decreased over time
                const color =
                    startRow.value === endRow.value
                        ? NO_CHANGE_COLOR
                        : startRow.value < endRow.value
                          ? INCREASE_COLOR
                          : DECREASE_COLOR

                const start = {
                    value: startRow.value,
                    time: startRow.originalTime,
                    color,
                } satisfies DumbbellHead
                const end = {
                    value: endRow.value,
                    time: endRow.originalTime,
                    color,
                } satisfies DumbbellHead

                const shortEntityName = getShortNameForEntity(entityName)
                const displayName = shortEntityName ?? entityName

                const annotation = getAnnotationsForSeries(
                    annotationsMap,
                    entityName
                )

                return {
                    seriesName: entityName,
                    entityName,
                    displayName,
                    shortEntityName,
                    annotation,
                    color,
                    start,
                    end,
                    focus: focusArray.state(entityName),
                }
            })
            .filter((series) => series !== undefined)
    }

    /** Constructs series by comparing two different columns' values at a single time point */
    private constructSeriesForTwoColumns(): DumbbellSeries[] {
        const { endTime, focusArray, annotationsMap } = this
        const [startColumn, endColumn] = this.yColumns

        if (!startColumn || !endColumn) return []

        return this.selectionArray.selectedEntityNames
            .map((entityName): DumbbellSeries | undefined => {
                const startRow = startColumn.owidRowByEntityNameAndTime
                    .get(entityName)
                    ?.get(endTime)
                const endRow = endColumn.owidRowByEntityNameAndTime
                    .get(entityName)
                    ?.get(endTime)

                // We can't plot a dumbbell if either the start or end value is missing or non-numeric
                if (
                    typeof startRow?.value !== "number" ||
                    typeof endRow?.value !== "number"
                )
                    return undefined

                const start = {
                    value: startRow.value,
                    time: startRow.originalTime,
                    color: START_COLUMN_COLOR,
                } satisfies DumbbellHead
                const end = {
                    value: endRow.value,
                    time: endRow.originalTime,
                    color: END_COLUMN_COLOR,
                } satisfies DumbbellHead

                const shortEntityName = getShortNameForEntity(entityName)
                const displayName = shortEntityName ?? entityName

                const annotation = getAnnotationsForSeries(
                    annotationsMap,
                    entityName
                )

                return {
                    seriesName: entityName,
                    entityName,
                    displayName,
                    shortEntityName,
                    annotation,
                    color: START_COLUMN_COLOR,
                    start,
                    end,
                    focus: focusArray.state(entityName),
                }
            })
            .filter((series) => series !== undefined)
    }

    @computed private get unsortedSeries(): DumbbellSeries[] {
        return this.seriesStrategy === SeriesStrategy.entity
            ? this.constructSeriesForTimeRange()
            : this.constructSeriesForTwoColumns()
    }

    @computed get series(): DumbbellSeries[] {
        return sortByConfig(this.unsortedSeries, this.sortConfig, {
            [SortBy.custom]: (series): number =>
                this.selectionArray.selectedEntityNames.indexOf(
                    series.entityName
                ),
            [SortBy.entityName]: (series): string => series.entityName,
            [SortBy.total]: (series): number =>
                series.start.value + series.end.value,
            [SortBy.column]: (series): number =>
                this.sortColumn?.owidRowsByEntityName?.get(
                    series.entityName
                )?.[0]?.value ?? 0,
        })
    }

    @computed get allValues(): number[] {
        return this.series.flatMap((series) => [
            series.start.value,
            series.end.value,
        ])
    }

    @computed get yDomainDefault(): [number, number] {
        const defaultDomain: [number, number] = [Infinity, -Infinity]
        return domainExtent(this.allValues, ScaleType.linear) ?? defaultDomain
    }

    @computed get errorInfo(): ChartErrorInfo {
        const message = getDefaultFailMessage(this.manager)
        if (message) return { reason: message }

        const { entityTypePlural = "entities" } = this.manager
        if (this.series.length === 0)
            return { reason: `No data for the selected ${entityTypePlural}` }

        return { reason: "" }
    }
}
