import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import { StackedDiscreteBarChartManager } from "./StackedDiscreteBarChart"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    ChartErrorInfo,
    ColorSchemeName,
    EntityName,
    FacetStrategy,
    MissingDataStrategy,
    SortBy,
    SortConfig,
    SortOrder,
} from "@ourworldindata/types"
import {
    autoDetectYColumnSlugs,
    getShortNameForEntity,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { Item, StackedSeries } from "./StackedConstants"
import {
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { excludeUndefined } from "@ourworldindata/utils"

export class StackedDiscreteBarChartState implements ChartState {
    manager: StackedDiscreteBarChartManager

    constructor({ manager }: { manager: StackedDiscreteBarChartManager }) {
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
        if (!this.yColumnSlugs.length) return table

        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        table = table.dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        table = this.applyMissingDataStrategy(table)

        if (this.manager.isRelativeMode) {
            table = table
                .replaceNegativeCellsWithErrorValues(this.yColumnSlugs)
                .toPercentageFromEachColumnForEachEntityAndTime(
                    this.yColumnSlugs
                )
        }

        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        table = table
            .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
            .replaceNegativeCellsWithErrorValues(this.yColumnSlugs)
            .dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        table = this.applyMissingDataStrategy(table)

        return table
    }

    private applyMissingDataStrategy(table: OwidTable): OwidTable {
        if (this.missingDataStrategy === MissingDataStrategy.hide) {
            // If MissingDataStrategy is explicitly set to hide, drop rows (= times) where one of
            // the y columns has no data
            return table.dropRowsWithErrorValuesForAnyColumn(this.yColumnSlugs)
        }

        // Otherwise, don't apply any special treatment
        return table
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @computed get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    @computed get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed get sortColumnSlug(): string | undefined {
        return this.sortConfig.sortColumnSlug
    }

    @computed get sortColumn(): CoreColumn | undefined {
        return this.sortColumnSlug
            ? this.transformedTable.getColumns([this.sortColumnSlug])[0]
            : undefined
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : null) ?? ColorSchemes.get(ColorSchemeName["owid-distinct"])
        )
    }

    @computed get categoricalColorAssigner(): CategoricalColorAssigner {
        const seriesCount = this.yColumns.length
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap: this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
            numColorsInUse: seriesCount,
        })
    }

    @computed get unstackedSeries(): StackedSeries<EntityName>[] {
        return (
            this.yColumns
                .map((col) => {
                    return {
                        seriesName: col.displayName,
                        columnSlug: col.slug,
                        color: this.categoricalColorAssigner.assign(
                            col.displayName
                        ),
                        points: col.owidRows.map((row) => ({
                            time: row.originalTime,
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
        return stackSeriesInBothDirections(
            withMissingValuesAsZeroes(this.unstackedSeries)
        )
    }

    @computed get items(): readonly Omit<Item, "label">[] {
        const entityNames = this.selectionArray.selectedEntityNames
        const items = entityNames
            .map((entityName) => {
                let totalValue = 0
                const bars = excludeUndefined(
                    this.series.map((series) => {
                        const point = series.points.find(
                            (point) => point.position === entityName
                        )
                        if (!point) return undefined
                        totalValue += point.value
                        return {
                            point,
                            columnSlug: series.columnSlug!,
                            color: series.color,
                            seriesName: series.seriesName,
                        }
                    })
                )

                return {
                    entityName,
                    shortEntityName: getShortNameForEntity(entityName),
                    bars,
                    totalValue,
                }
            })
            .filter((item) => item.bars.length)

        return items
    }

    @computed get sortedItems(): readonly Item[] {
        let sortByFunc: (item: Item) => number | string | undefined
        switch (this.sortConfig.sortBy) {
            case SortBy.custom:
                sortByFunc = (): undefined => undefined
                break
            case SortBy.entityName:
                sortByFunc = (item: Item): string => item.entityName
                break
            case SortBy.column: {
                const owidRowsByEntityName =
                    this.sortColumn?.owidRowsByEntityName
                sortByFunc = (item: Item): number => {
                    const rows = owidRowsByEntityName?.get(item.entityName)
                    return rows?.[0]?.value ?? 0
                }
                break
            }
            default:
            case SortBy.total:
                sortByFunc = (item: Item): number => item.totalValue
        }
        const sortedItems = _.sortBy(this.items, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) return sortedItems.toReversed()
        else return sortedItems
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies = [FacetStrategy.none]

        if (this.yColumns.length > 1) strategies.push(FacetStrategy.metric)

        return strategies
    }

    @computed get errorInfo(): ChartErrorInfo {
        const column = this.yColumns[0]

        if (!column) return { reason: "No column to chart" }

        if (!this.selectionArray.hasSelection)
            return { reason: `No data selected` }

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? { reason: "No matching data" }
            : { reason: "" }
    }
}
