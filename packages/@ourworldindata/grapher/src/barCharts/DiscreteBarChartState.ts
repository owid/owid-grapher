import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import {
    DiscreteBarChartManager,
    DiscreteBarItem,
    DiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import {
    CoreColumn,
    isNotErrorValue,
    OwidTable,
} from "@ourworldindata/core-table"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { SelectionArray } from "../selection/SelectionArray"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getShortNameForEntity,
    makeSelectionArray,
} from "../chart/ChartUtils"
import {
    ChartErrorInfo,
    ColorScaleConfigInterface,
    ColorSchemeName,
    FacetStrategy,
    SeriesStrategy,
    SortBy,
    SortConfig,
    SortOrder,
} from "@ourworldindata/types"
import { OWID_ERROR_COLOR, OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { FocusArray } from "../focus/FocusArray"

export class DiscreteBarChartState implements ChartState, ColorScaleManager {
    manager: DiscreteBarChartManager

    colorScale: ColorScale
    defaultBaseColorScheme = ColorSchemeName.SingleColorDenim
    defaultNoDataColor = OWID_NO_DATA_GRAY

    constructor({ manager }: { manager: DiscreteBarChartManager }) {
        this.manager = manager
        this.colorScale = manager.colorScaleOverride ?? new ColorScale(this)
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

        if (this.colorColumnSlug) {
            table = table
                // TODO: remove this filter once we don't have mixed type columns in datasets
                // Currently we set skipParsing=true on these columns to be backwards-compatible
                .replaceNonNumericCellsWithErrorValues([this.colorColumnSlug])
                .interpolateColumnWithTolerance(this.colorColumnSlug)
        }

        return table
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get focusArray(): FocusArray {
        return this.manager.focusArray ?? new FocusArray()
    }

    @computed get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get colorColumnSlug(): string | undefined {
        // Discrete bar charts only support numeric variables as color dimension
        return this.manager.numericColorColumnSlug
    }

    @computed get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed get hasProjectedData(): boolean {
        return this.series.some((series) => series.yColumn.isProjection)
    }

    @computed private get colorScheme(): ColorScheme {
        const defaultColorScheme = this.defaultBaseColorScheme
        const colorScheme = this.manager.baseColorScheme ?? defaultColorScheme

        // Don't reuse the line chart's color scheme (typically owid-distinct)
        // and use the default color scheme instead (single color)
        return this.manager.hasLineChart || this.manager.hasSlopeChart
            ? ColorSchemes.get(defaultColorScheme)
            : ColorSchemes.get(colorScheme)
    }

    @computed get colorScaleColumn(): CoreColumn {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ?? // We need to use inputTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.
            this.inputTable.get(this.colorColumnSlug)
        )
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get hasColorScale(): boolean {
        return !this.colorColumn.isMissing
    }

    @computed get hasNoDataBin(): boolean {
        if (!this.hasColorScale) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    @computed get seriesStrategy(): SeriesStrategy {
        const autoStrategy = autoDetectSeriesStrategy(this.manager, true)
        // TODO this is an inconsistency between LineChart and DiscreteBar.
        // We should probably make it consistent at some point.
        if (
            autoStrategy === SeriesStrategy.column &&
            this.selectionArray.numSelectedEntities > 1
        ) {
            return SeriesStrategy.entity
        }
        if (
            autoStrategy === SeriesStrategy.entity &&
            this.selectionArray.numSelectedEntities === 1 &&
            this.yColumns.length > 1
        ) {
            return SeriesStrategy.column
        }
        return autoStrategy
    }

    private constructSeries(
        col: CoreColumn,
        indexes: number[]
    ): DiscreteBarItem[] {
        const { transformedTable, colorColumn, hasColorScale } = this
        const values = col.valuesIncludingErrorValues
        const originalTimes = col.originalTimeColumn.valuesIncludingErrorValues
        const entityNames =
            transformedTable.entityNameColumn.valuesIncludingErrorValues
        const colorValues = colorColumn.valuesIncludingErrorValues
        return indexes.map((index): DiscreteBarItem => {
            const isColumnStrategy =
                this.seriesStrategy === SeriesStrategy.column
            const seriesName = isColumnStrategy
                ? col.displayName
                : (entityNames[index] as string)
            const colorValue = isNotErrorValue(colorValues[index])
                ? colorValues[index]
                : undefined
            const color = hasColorScale
                ? this.colorScale.getColor(colorValue)
                : isColumnStrategy
                  ? col.def.color
                  : transformedTable.getColorForEntityName(
                        entityNames[index] as string
                    )
            return {
                yColumn: col,
                seriesName,
                value: values[index] as number,
                time: originalTimes[index] as number,
                colorValue,
                color,
            }
        })
    }

    @computed get columnsAsSeries(): DiscreteBarItem[] {
        return this.yColumns.flatMap((col) =>
            this.constructSeries(col, col.validRowIndices.slice(0, 1))
        )
    }

    @computed get entitiesAsSeries(): DiscreteBarItem[] {
        const col = this.yColumns[0]
        return this.constructSeries(col, col.validRowIndices)
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed get sortedRawSeries(): DiscreteBarItem[] {
        const raw =
            this.seriesStrategy === SeriesStrategy.entity
                ? this.entitiesAsSeries
                : this.columnsAsSeries

        let sortByFunc: (item: DiscreteBarItem) => number | string | undefined
        switch (this.sortConfig.sortBy) {
            case SortBy.custom:
                if (this.seriesStrategy === SeriesStrategy.entity) {
                    sortByFunc = (item: DiscreteBarItem): number =>
                        this.selectionArray.selectedEntityNames.indexOf(
                            item.seriesName
                        )
                } else {
                    sortByFunc = (): undefined => undefined
                }
                break
            case SortBy.entityName:
                sortByFunc = (item: DiscreteBarItem): string => item.seriesName
                break
            default:
            case SortBy.total:
            case SortBy.column: // we only have one yColumn, so total and column are the same
                sortByFunc = (item: DiscreteBarItem): number => item.value
                break
        }
        const sortedSeries = _.sortBy(raw, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) return sortedSeries.toReversed()
        else return sortedSeries
    }

    @computed private get valuesToColorsMap(): Map<number, string> {
        const { manager, colorScheme, sortedRawSeries } = this

        return colorScheme.getUniqValueColorMap(
            _.uniq(sortedRawSeries.map((series) => series.value)),
            !manager.invertColorScheme // negate here to be consistent with how things worked before
        )
    }

    @computed get series(): DiscreteBarSeries[] {
        const series = this.sortedRawSeries.map((rawSeries) => {
            const { value, time, colorValue, seriesName, color, yColumn } =
                rawSeries
            const series: DiscreteBarSeries = {
                yColumn,
                value,
                time,
                colorValue,
                seriesName,
                entityName: seriesName,
                shortEntityName: getShortNameForEntity(seriesName),
                // the error color should never be used but I prefer it here instead of throwing an exception if something goes wrong
                color:
                    color ??
                    this.valuesToColorsMap.get(value) ??
                    OWID_ERROR_COLOR,
                focus: this.focusArray.state(seriesName),
            }
            return series
        })

        return series
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        // if we have multi-dimension, multi-entity data (which is necessarily single-year),
        // then *only* faceting makes sense. otherwise, faceting is not useful.
        if (
            this.yColumns.length > 1 &&
            this.selectionArray.numSelectedEntities > 1
        ) {
            // if we have more than one unit, then faceting by entity is not allowed
            // as comparing multiple units in a single chart isn't meaningful
            const uniqueUnits = new Set(
                this.yColumns.map((column) => column.shortUnit)
            )
            if (uniqueUnits.size > 1) {
                return [FacetStrategy.metric]
            }

            return [FacetStrategy.entity, FacetStrategy.metric]
        }

        return [FacetStrategy.none]
    }

    @computed get errorInfo(): ChartErrorInfo {
        const column = this.yColumns[0]

        if (!column) return { reason: "No column to chart" }

        if (!this.selectionArray.hasSelection)
            return { reason: "No data selected" }

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? { reason: "No matching data" }
            : { reason: "" }
    }
}
