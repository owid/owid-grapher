import { ChartState } from "../chart/ChartInterface.js"
import { ChartManager } from "../chart/ChartManager.js"
import {
    ChartErrorInfo,
    ColorSchemeName,
    FacetStrategy,
    MissingDataStrategy,
    SeriesStrategy,
} from "@ourworldindata/types"
import { computed, makeObservable } from "mobx"
import {
    StackedPoint,
    StackedRawSeries,
    StackedSeries,
} from "./StackedConstants.js"
import {
    OwidTable,
    CoreColumn,
    isNotErrorValueOrEmptyCell,
} from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { ColorSchemes } from "../color/ColorSchemes.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import {
    CategoricalColorAssigner,
    CategoricalColorMap,
} from "../color/CategoricalColorAssigner.js"
import { BinaryMapPaletteE } from "../color/CustomSchemes.js"
import { checkIsStackingEntitiesSensible } from "./StackedUtils.js"
import { FocusArray } from "../focus/FocusArray.js"

// used in StackedBar charts to color negative and positive bars
const POSITIVE_COLOR = BinaryMapPaletteE.colorSets[0][0] // orange
const NEGATIVE_COLOR = BinaryMapPaletteE.colorSets[0][1] // blue

export abstract class AbstractStackedChartState implements ChartState {
    manager: ChartManager

    abstract shouldRunLinearInterpolation: boolean

    abstract get series(): readonly StackedSeries<number>[]
    abstract get useValueBasedColorScheme(): boolean

    constructor({ manager }: { manager: ChartManager }) {
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
        table = table
            .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
            .dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        if (this.shouldRunLinearInterpolation) {
            this.yColumnSlugs.forEach((slug) => {
                table = table.interpolateColumnLinearly(slug)
            })
        }

        // Drop rows for which no valid data points exist for any display column
        // after interpolation, which most likely means they lie at the start/end
        // of the time range and were not extrapolated
        if (this.missingDataStrategy !== MissingDataStrategy.show) {
            table = table.dropRowsWithErrorValuesForAnyColumn(this.yColumnSlugs)
        }

        if (this.manager.isRelativeMode) {
            table = this.isEntitySeries
                ? table.toPercentageFromEachEntityForEachTime(
                      this.yColumnSlugs[0]
                  )
                : table.toPercentageFromEachColumnForEachEntityAndTime(
                      this.yColumnSlugs
                  )
        }
        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy !== MissingDataStrategy.show) {
            table = table
                .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
                .dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

            if (this.shouldRunLinearInterpolation) {
                this.yColumnSlugs.forEach((slug) => {
                    table = table.interpolateColumnLinearly(slug)
                })
            }

            table = table.dropRowsWithErrorValuesForAnyColumn(this.yColumnSlugs)
        }

        return table
    }

    @computed get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @computed get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager)
    }

    @computed
    get columnsAsSeries(): readonly StackedRawSeries<number>[] {
        return this.yColumns
            .map((col) => {
                return {
                    isProjection: col.isProjection,
                    seriesName: col.displayName,
                    rows: col.owidRows,
                    focus: this.focusArray.state(col.displayName),
                }
            })
            .toReversed() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed
    get entitiesAsSeries(): readonly StackedRawSeries<number>[] {
        if (!this.yColumns.length) return []

        const { isProjection, owidRowsByEntityName } = this.yColumns[0]
        return this.selectionArray.selectedEntityNames
            .map((seriesName) => {
                return {
                    isProjection,
                    seriesName,
                    rows: owidRowsByEntityName.get(seriesName) || [],
                    focus: this.focusArray.state(seriesName),
                }
            })
            .toReversed() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed
    get rawSeries(): readonly StackedRawSeries<number>[] {
        return this.isEntitySeries
            ? this.entitiesAsSeries
            : this.columnsAsSeries
    }

    @computed
    get allStackedPoints(): readonly StackedPoint<number>[] {
        return this.series.flatMap((series) => series.points)
    }

    @computed get colorMap(): CategoricalColorMap {
        return this.isEntitySeries
            ? this.inputTable.entityNameColorIndex
            : this.inputTable.columnDisplayNameToColorMap
    }

    @computed get categoricalColorAssigner(): CategoricalColorAssigner {
        const seriesCount = this.isEntitySeries
            ? this.selectionArray.numSelectedEntities
            : this.yColumns.length
        return new CategoricalColorAssigner({
            colorScheme:
                (this.manager.baseColorScheme
                    ? ColorSchemes.get(this.manager.baseColorScheme)
                    : null) ??
                ColorSchemes.get(ColorSchemeName.stackedAreaDefault),
            invertColorScheme: this.manager.invertColorScheme,
            colorMap: this.colorMap,
            autoColorMapCache: this.manager.seriesColorMap,
            numColorsInUse: seriesCount,
        })
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get focusArray(): FocusArray {
        return this.manager.focusArray ?? new FocusArray()
    }

    @computed get isEntitySeries(): boolean {
        return this.seriesStrategy === SeriesStrategy.entity
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies: FacetStrategy[] = []

        const { selectedEntityNames } = this.selectionArray
        const areMultipleEntitiesSelected = selectedEntityNames.length > 1
        const hasMultipleYColumns = this.yColumns.length > 1
        const shortUnits = this.yColumns.map((column) => column.shortUnit)
        const uniqueUnits = new Set(shortUnits)
        const hasMultipleUnits = uniqueUnits.size > 1
        const hasPercentageUnit = shortUnits.some(
            (shortUnit) => shortUnit === "%"
        )

        // Normally StackedArea/StackedBar charts are always single-entity or single-column,
        // but if we are ever in a mode where we have multiple entities selected (e.g. through
        // GlobalEntitySelector) and multiple columns, it only makes sense when faceted.
        if (
            // No facet strategy makes sense if columns are stacked and a single entity is selected
            (!this.isEntitySeries && !areMultipleEntitiesSelected) ||
            // No facet strategy makes sense if entities are stacked and we have a single column
            (this.isEntitySeries &&
                !hasMultipleYColumns &&
                // The stacking must be sensible
                checkIsStackingEntitiesSensible(selectedEntityNames))
        )
            strategies.push(FacetStrategy.none)

        if (
            // Facetting by entity makes sense if multiple entities are selected
            areMultipleEntitiesSelected &&
            // Stacking columns with different units isn't allowed
            !hasMultipleUnits
        )
            strategies.push(FacetStrategy.entity)

        if (
            // Facetting by column makes sense if we have multiple columns
            hasMultipleYColumns &&
            // Stacking percentages doesn't make sense unless we're in relative mode
            (!hasPercentageUnit || this.manager.isRelativeMode) &&
            // Some stacked entity combinations are not allowed, e.g. stacking
            // countries on top their continent or stacking countries or continents
            // on top of World
            checkIsStackingEntitiesSensible(selectedEntityNames)
        )
            strategies.push(FacetStrategy.metric)

        return strategies
    }

    @computed get unstackedSeries(): readonly StackedSeries<number>[] {
        return this.rawSeries
            .filter((series) => series.rows.length > 0)

            .map((series) => {
                const { isProjection, seriesName, rows } = series

                const points = rows.map((row) => {
                    const pointColor =
                        row.value > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR
                    return {
                        position: row.originalTime,
                        time: row.originalTime,
                        value: row.value,
                        valueOffset: 0,
                        interpolated:
                            this.shouldRunLinearInterpolation &&
                            isNotErrorValueOrEmptyCell(row.value) &&
                            !isNotErrorValueOrEmptyCell(row.originalValue),
                        // takes precedence over the series color if given
                        color: this.useValueBasedColorScheme
                            ? pointColor
                            : undefined,
                    }
                })

                return {
                    seriesName,
                    isProjection,
                    points,
                    isAllZeros: points.every((point) => point.value === 0),
                    color: this.categoricalColorAssigner.assign(seriesName),
                    focus: series.focus,
                }
            })
    }

    @computed get errorInfo(): ChartErrorInfo {
        const { yColumnSlugs } = this
        if (!yColumnSlugs.length) return { reason: "Missing variable" }
        if (!this.unstackedSeries.length) return { reason: "No matching data" }
        if (!this.allStackedPoints.length)
            return { reason: "No matching points" }
        return { reason: "" }
    }
}
