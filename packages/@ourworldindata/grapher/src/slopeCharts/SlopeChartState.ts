import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import {
    SlopeChartManager,
    RawSlopeChartSeries,
    SlopeChartSeries,
} from "./SlopeChartConstants"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { FocusArray } from "../focus/FocusArray"
import {
    ColumnSlug,
    ScaleType,
    MissingDataStrategy,
    SeriesStrategy,
    FacetStrategy,
    Time,
    EntityName,
    ColorSchemeName,
    ChartErrorInfo,
} from "@ourworldindata/types"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getShortNameForEntity,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import {
    AnnotationsMap,
    getAnnotationsForSeries,
    getAnnotationsMap,
    getColorKey,
    getDisplayName,
    getSeriesName,
} from "../lineCharts/LineChartHelpers"
import { domainExtent } from "@ourworldindata/utils"
import { AxisConfig } from "../axis/AxisConfig"
import { VerticalAxis } from "../axis/Axis"

export class SlopeChartState implements ChartState {
    manager: SlopeChartManager

    defaultBaseColorScheme = ColorSchemeName.OwidDistinctLines

    constructor({ manager }: { manager: SlopeChartManager }) {
        this.manager = manager
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
        // any rows before startTime and change the timeline bounds.
        const { isRelativeMode, startTime } = this.manager
        if (isRelativeMode && startTime !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startTime,
                this.yColumnSlugs ?? []
            )
        }
        return table
    }

    transformTable(table: OwidTable) {
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

    transformTableForSelection(table: OwidTable): OwidTable {
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        // if time selection is disabled, then filter all entities that
        // don't have data for the current time period
        if (!this.manager.hasTimeline && this.startTime !== this.endTime) {
            table = table
                .filterByTargetTimes([this.startTime, this.endTime])
                .dropEntitiesThatHaveSomeMissingOrErrorValueInAllColumns(
                    this.yColumnSlugs
                )
        }

        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy === MissingDataStrategy.hide) {
            table = table.dropEntitiesThatHaveNoDataInSomeColumn(
                this.yColumnSlugs
            )
        }

        return table
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get focusArray(): FocusArray {
        return this.manager.focusArray ?? new FocusArray()
    }

    @computed get isFocusModeActive(): boolean {
        return this.focusArray.hasFocusedSeries
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

    @computed get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
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

    @computed get startTime(): Time {
        return this.transformedTable.minTime ?? 0
    }

    @computed get endTime(): Time {
        return this.transformedTable.maxTime ?? 0
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies: FacetStrategy[] = [FacetStrategy.none]

        if (this.selectionArray.numSelectedEntities > 1)
            strategies.push(FacetStrategy.entity)

        if (this.yColumns.length > 1) strategies.push(FacetStrategy.metric)

        return strategies
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

    @computed get annotationsMap(): AnnotationsMap | undefined {
        return getAnnotationsMap(this.inputTable, this.yColumnSlugs[0])
    }

    private constructSingleSeries(
        entityName: EntityName,
        column: CoreColumn
    ): RawSlopeChartSeries {
        const { startTime, endTime, seriesStrategy } = this
        const { canSelectMultipleEntities } = this.manager
        const { availableEntityNames } = this.transformedTable

        const columnName = column.nonEmptyDisplayName
        const hasMultipleEntitiesSelected = availableEntityNames.length > 1
        const seriesName = getSeriesName({
            entityName,
            columnName,
            seriesStrategy,
            hasMultipleEntitiesSelected,
            allowsMultiEntitySelection: canSelectMultipleEntities,
        })
        const displayName = getDisplayName({
            entityName: getShortNameForEntity(entityName) ?? entityName,
            columnName,
            seriesStrategy,
            hasMultipleEntitiesSelected,
        })

        const owidRowByTime = column.owidRowByEntityNameAndTime.get(entityName)
        const start = owidRowByTime?.get(startTime)
        const end = owidRowByTime?.get(endTime)

        const colorKey = getColorKey({
            entityName,
            columnName,
            seriesStrategy,
            hasMultipleEntitiesSelected,
        })
        const color = this.categoricalColorAssigner.assign(colorKey)

        const annotation = getAnnotationsForSeries(
            this.annotationsMap,
            seriesName
        )

        const focus = this.focusArray.state(seriesName)

        return {
            column,
            seriesName,
            entityName,
            displayName,
            color,
            start,
            end,
            annotation,
            focus,
        }
    }

    isSeriesValid(series: RawSlopeChartSeries): series is SlopeChartSeries {
        const {
            start,
            end,
            column: { tolerance },
        } = series

        // if the start or end value is missing, we can't draw the slope
        if (start?.value === undefined || end?.value === undefined) return false

        // sanity check (might happen if tolerance is enabled)
        if (start.originalTime >= end.originalTime) return false

        const isToleranceAppliedToStartValue =
            start.originalTime !== this.startTime
        const isToleranceAppliedToEndValue = end.originalTime !== this.endTime

        // if tolerance has been applied to one of the values, then we require
        // a minimal distance between the original times
        if (isToleranceAppliedToStartValue || isToleranceAppliedToEndValue) {
            return end.originalTime - start.originalTime >= tolerance
        }

        return true
    }

    // Usually we drop rows with missing data in the transformTable function.
    // But if we did that for slope charts, we wouldn't know whether a slope
    // has been dropped because it actually had no data or a sibling slope had
    // no data. But we need that information for the "No data" section. That's
    // why the filtering happens here, so that the noDataSeries can be populated
    // correctly.
    private shouldSeriesBePlotted(
        series: RawSlopeChartSeries
    ): series is SlopeChartSeries {
        if (!this.isSeriesValid(series)) return false

        // when the missing data strategy is set to "hide", we might
        // choose not to plot a valid series
        if (
            this.seriesStrategy === SeriesStrategy.column &&
            this.missingDataStrategy === MissingDataStrategy.hide
        ) {
            const allSeriesForEntity = this.rawSeriesByEntityName.get(
                series.entityName
            )
            return !!allSeriesForEntity?.every((series) =>
                this.isSeriesValid(series)
            )
        }

        return true
    }

    @computed get rawSeries(): RawSlopeChartSeries[] {
        return this.yColumns.flatMap((column) =>
            this.selectionArray.selectedEntityNames.map((entityName) =>
                this.constructSingleSeries(entityName, column)
            )
        )
    }

    @computed get rawSeriesByEntityName(): Map<
        EntityName,
        RawSlopeChartSeries[]
    > {
        const map = new Map<EntityName, RawSlopeChartSeries[]>()
        this.rawSeries.forEach((series) => {
            const { entityName } = series
            if (!map.has(entityName)) map.set(entityName, [])
            map.get(entityName)!.push(series)
        })
        return map
    }

    @computed get series(): SlopeChartSeries[] {
        return this.rawSeries.filter((series) =>
            this.shouldSeriesBePlotted(series)
        )
    }

    @computed get allYValues(): number[] {
        return this.series.flatMap((series) => [
            series.start.value,
            series.end.value,
        ])
    }

    @computed get xDomain(): [number, number] {
        return [this.startTime, this.endTime]
    }

    @computed get yDomainDefault(): [number, number] {
        const defaultDomain: [number, number] = [Infinity, -Infinity]
        return domainExtent(this.allYValues, this.yScaleType) ?? defaultDomain
    }

    toVerticalAxis(
        config: AxisConfig,
        {
            yDomain,
            yRange,
        }: { yDomain: [number, number]; yRange: [number, number] }
    ): VerticalAxis {
        const axis = config.toVerticalAxis()
        axis.domain = yDomain
        axis.range = yRange
        axis.formatColumn = this.yColumns[0]
        axis.label = ""
        return axis
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
