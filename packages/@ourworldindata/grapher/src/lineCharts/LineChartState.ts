import * as _ from "lodash-es"
import * as R from "remeda"
import { Color } from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import {
    ScaleType,
    EntityName,
    SeriesStrategy,
    FacetStrategy,
    CoreValueType,
    MissingDataStrategy,
    ColorScaleConfigInterface,
    ColorSchemeName,
    ChartErrorInfo,
} from "@ourworldindata/types"
import { ColorSchemes } from "../color/ColorSchemes"
import { ChartState } from "../chart/ChartInterface"
import {
    LineChartSeries,
    LineChartManager,
    LinePoint,
    DEFAULT_LINE_COLOR,
} from "./LineChartConstants"
import {
    OwidTable,
    CoreColumn,
    isNotErrorValue,
} from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { ColorScheme } from "../color/ColorScheme"
import { SelectionArray } from "../selection/SelectionArray"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { getColorKey, getSeriesName } from "./LineChartHelpers"

export class LineChartState implements ChartState, ColorScaleManager {
    manager: LineChartManager

    colorScale: ColorScale
    defaultBaseColorScheme = ColorSchemeName.OwidDistinctLines
    defaultNoDataColor = OWID_NO_DATA_GRAY

    constructor({ manager }: { manager: LineChartManager }) {
        this.manager = manager
        this.colorScale = manager.colorScaleOverride ?? new ColorScale(this)
        makeObservable(this)
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        // The % growth transform cannot be applied in transformTable() because it will filter out
        // any rows before startHandleTimeBound and change the timeline bounds.
        const { isRelativeMode, startTime } = this.manager
        if (isRelativeMode && startTime !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startTime,
                this.manager.yColumnSlugs ?? []
            )
        }
        return table
    }

    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        // Currently we set skipParsing=true on these columns to be backwards-compatible
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        if (this.colorColumnSlug) {
            table = table
                // TODO: remove this filter once we don't have mixed type columns in datasets
                // Currently we set skipParsing=true on these columns to be backwards-compatible
                .replaceNonNumericCellsWithErrorValues([this.colorColumnSlug])
                .interpolateColumnWithTolerance(this.colorColumnSlug)
        }

        // drop all data when the author chose to hide entities with missing data and
        // at least one of the variables has no data for the current entity
        if (
            this.missingDataStrategy === MissingDataStrategy.hide &&
            table.hasAnyColumnNoValidValue(this.yColumnSlugs)
        ) {
            table = table.dropAllRows()
        }

        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy === MissingDataStrategy.hide) {
            table = table
                .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
                .dropEntitiesThatHaveNoDataInSomeColumn(this.yColumnSlugs)
        }

        return table
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get colorColumnSlug(): string | undefined {
        // Line charts only support numeric variables as color dimension
        return this.manager.numericColorColumnSlug
    }

    @computed get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get isLogScale(): boolean {
        return this.manager.yAxisConfig?.scaleType === ScaleType.log
    }

    @computed get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : null) ?? ColorSchemes.get(this.defaultBaseColorScheme)
        )
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

    @computed get categoricalColorAssigner(): CategoricalColorAssigner {
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap:
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
        })
    }

    @computed get hasColorScale(): boolean {
        return !this.colorColumn.isMissing
    }

    getColorScaleColor(value: CoreValueType | undefined): Color {
        return this.colorScale.getColor(value) ?? DEFAULT_LINE_COLOR
    }

    @computed get hasNoDataBin(): boolean {
        if (!this.hasColorScale) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    @computed get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed get series(): readonly LineChartSeries[] {
        return this.yColumns.flatMap((col) =>
            col.uniqEntityNames.map(
                (entityName): LineChartSeries =>
                    this.constructSingleSeries(entityName, col)
            )
        )
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies: FacetStrategy[] = [FacetStrategy.none]

        if (this.selectionArray.numSelectedEntities > 1)
            strategies.push(FacetStrategy.entity)

        const numNonProjectionColumns = this.yColumns.filter(
            (c) => !c.display?.isProjection
        ).length
        if (numNonProjectionColumns > 1) strategies.push(FacetStrategy.metric)

        return strategies
    }

    private constructSingleSeries(
        entityName: EntityName,
        column: CoreColumn
    ): LineChartSeries {
        const {
            manager: { canSelectMultipleEntities = false },
            transformedTable: { availableEntityNames },
            seriesStrategy,
            hasColorScale,
            colorColumn,
        } = this

        // Construct the points
        const timeValues = column.originalTimeColumn.valuesIncludingErrorValues
        const values = column.valuesIncludingErrorValues
        const colorValues = colorColumn.valuesIncludingErrorValues
        // If Y and Color are the same column, we need to get rid of any duplicate rows.
        // Duplicates occur because Y doesn't have tolerance applied, but Color does.
        const rowIndexes = _.sortedUniqBy(
            this.transformedTable.rowIndicesByEntityName
                .get(entityName)!
                .filter((index) => _.isNumber(values[index])),
            (index) => timeValues[index]
        )
        const points = rowIndexes.map((index) => {
            const point: LinePoint = {
                x: timeValues[index] as number,
                y: values[index] as number,
            }
            if (hasColorScale) {
                const colorValue = colorValues[index]
                point.colorValue = isNotErrorValue(colorValue)
                    ? colorValue
                    : undefined
            }
            return point
        })

        // Construct series properties
        const columnName = column.nonEmptyDisplayName
        const seriesName = getSeriesName({
            entityName,
            columnName,
            seriesStrategy,
            availableEntityNames,
            canSelectMultipleEntities,
        })

        let seriesColor: Color
        if (hasColorScale) {
            const colorValue = R.last(points)?.colorValue
            seriesColor = this.getColorScaleColor(colorValue)
        } else {
            seriesColor = this.categoricalColorAssigner.assign(
                getColorKey({
                    entityName,
                    columnName,
                    seriesStrategy,
                    availableEntityNames,
                })
            )
        }

        return {
            points,
            seriesName,
            isProjection: column.isProjection,
            plotMarkersOnly: column.display?.plotMarkersOnlyInLineChart,
            color: seriesColor,
        }
    }

    @computed get errorInfo(): ChartErrorInfo {
        const message = getDefaultFailMessage(this.manager)
        if (message) return { reason: message }
        if (
            this.manager.startTime !== undefined &&
            this.manager.startTime === this.manager.endTime
        )
            return {
                reason: "Two time points needed",
                help: "Click the timeline to select a second time point",
            }

        const { entityTypePlural = "entities" } = this.manager
        if (!this.series.length)
            return {
                reason: `No data for the selected ${entityTypePlural}`,
            }
        return { reason: "" }
    }
}
