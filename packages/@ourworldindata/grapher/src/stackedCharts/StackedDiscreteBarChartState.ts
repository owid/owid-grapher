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
    SortConfig,
} from "@ourworldindata/types"
import {
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedSeries } from "./StackedConstants"
import {
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"

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

            // Apply missing data strategy _again_ because we might've introduced new error values just now
            table = this.applyMissingDataStrategy(table)
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
        // We want to remove all rows with missing data for at least one column if:
        // - MissingDataStrategy is explicitly set to hide, or
        // - We are in relative mode and MissingDataStrategy is not explicitly set to show:
        //     If we are showing relative mode, we want to drop all rows that are missing data for
        //     any column, because otherwise the displayed data will be misleading in that it may
        //     suggest patterns that are not actually present.
        //     see https://github.com/owid/owid-grapher/issues/2860

        const shouldRemoveRows =
            this.missingDataStrategy === MissingDataStrategy.hide ||
            (this.manager.isRelativeMode &&
                this.missingDataStrategy !== MissingDataStrategy.show)
        if (shouldRemoveRows) {
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

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies = [FacetStrategy.none]

        if (this.yColumns.length > 1) strategies.push(FacetStrategy.metric)

        return strategies
    }

    @computed get errorInfo(): ChartErrorInfo {
        const column = this.yColumns[0]

        if (!column) return { reason: "No column to chart" }

        const message = getDefaultFailMessage(this.manager)
        if (message) return { reason: message }

        const { entityTypePlural = "entities" } = this.manager

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? {
                  reason: `No data for the selected ${entityTypePlural}`,
              }
            : { reason: "" }
    }
}
