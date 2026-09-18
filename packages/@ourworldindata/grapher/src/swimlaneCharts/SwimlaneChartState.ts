import * as R from "remeda"
import { match } from "ts-pattern"
import { computed, makeObservable } from "mobx"
import {
    ChartErrorInfo,
    ColorScaleConfigInterface,
    ColorSchemeName,
    ColumnSlug,
    FacetStrategy,
    JsTypes,
    ScaleType,
    SortBy,
    SortConfig,
    SwimlaneSegmentLabels,
    Time,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getShortNameForEntity,
    makeSelectionArray,
    SortKey,
    sortByConfig,
} from "../chart/ChartUtils"
import { OWID_ERROR_COLOR } from "../color/ColorConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { AxisConfig } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import {
    ColoredSwimlaneSegment,
    isSwimlaneSortKey,
    RankedSwimlane,
    SWIMLANE_SORT_KEYS,
    SwimlaneCategories,
    SwimlaneChartManager,
    SwimlaneObservation,
    SwimlaneSeries,
    SwimlaneSortKey,
} from "./SwimlaneChartConstants"
import {
    sortByCategory,
    toRankedSwimlane,
    toSwimlaneSegments,
} from "./SwimlaneChartHelpers"
import { SWIMLANE_CHART_CONFIG_DEFAULTS } from "./SwimlaneChartConfig"

export class SwimlaneChartState implements ChartState, ColorScaleManager {
    manager: SwimlaneChartManager

    colorScale: ColorScale
    hasNoDataBin = true

    constructor({ manager }: { manager: SwimlaneChartManager }) {
        this.manager = manager
        this.colorScale = new ColorScale(this)
        makeObservable(this)
    }

    @computed get defaultBaseColorScheme(): ColorSchemeName {
        return this.categories?.kind === "ordinal"
            ? ColorSchemeName.SingleColorGradientDenim
            : ColorSchemeName.OwidCategoricalA
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
        if (!this.yColumnSlug) return table

        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        return table.interpolateColumnWithTolerance(this.yColumnSlug)
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get yColumnSlugs(): ColumnSlug[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get yColumnSlug(): ColumnSlug | undefined {
        return this.yColumnSlugs[0]
    }

    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumn
    }

    @computed get inputYColumn(): CoreColumn {
        return this.inputTable.get(this.yColumnSlug)
    }

    @computed get colorScaleColumn(): CoreColumn {
        return this.inputYColumn
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorScaleColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get segmentLabels(): SwimlaneSegmentLabels {
        return (
            this.manager.swimlane?.segmentLabels ??
            SWIMLANE_CHART_CONFIG_DEFAULTS.segmentLabels
        )
    }

    @computed get categories(): SwimlaneCategories | undefined {
        const column = this.colorScaleColumn
        if (column.isMissing || column.jsType !== JsTypes.string)
            return undefined

        const values: string[] = column.sortedUniqNonEmptyStringVals
        return column.allowedValuesSorted
            ? { kind: "ordinal", values }
            : { kind: "categorical", values }
    }

    @computed private get timesAsc(): Time[] {
        const { startTime, endTime } = this.manager
        const times = this.inputYColumn.uniqTimesAsc
        if (startTime === undefined || endTime === undefined) return times
        return times.filter((time) => time >= startTime && time <= endTime)
    }

    @computed private get unsortedSeries(): SwimlaneSeries[] {
        if (this.yColumn.isMissing) return []

        const { yColumn, timesAsc, colorScale } = this

        return this.selectionArray.selectedEntityNames.map(
            (entityName): SwimlaneSeries => {
                const rows =
                    yColumn.owidRowByEntityNameAndTime
                        .get(entityName)
                        ?.values() ?? []

                const observations: SwimlaneObservation[] = Array.from(rows)
                    .filter((row) => R.isString(row.value) && row.value !== "")
                    .map((row) => ({ time: row.time, category: row.value }))

                const segments: ColoredSwimlaneSegment[] = toSwimlaneSegments({
                    observations,
                    timesAsc,
                }).map((segment) =>
                    match(segment)
                        .with({ kind: "category" }, (categorySegment) => ({
                            ...categorySegment,
                            // A category always has a bin, so the error color should never be drawn
                            color:
                                colorScale.getColor(categorySegment.category) ??
                                OWID_ERROR_COLOR,
                        }))
                        .with(
                            { kind: "missing" },
                            (missingSegment) => missingSegment
                        )
                        .exhaustive()
                )

                const lastCategorySegment = R.last(
                    segments.filter((segment) => segment.kind === "category")
                )

                return {
                    seriesName: entityName,
                    entityName,
                    shortEntityName: getShortNameForEntity(entityName),
                    color: lastCategorySegment?.color ?? colorScale.noDataColor,
                    segments,
                }
            }
        )
    }

    @computed get sortConfig(): SortConfig {
        const { sortBy, sortOrder } = this.manager.sortConfig ?? {}
        return {
            sortBy:
                sortBy && isSwimlaneSortKey(sortBy)
                    ? sortBy
                    : this.defaultSortKey,
            sortOrder,
        }
    }

    @computed get series(): SwimlaneSeries[] {
        const categories = this.categories?.values ?? []

        const keyFns: Record<SwimlaneSortKey, SortKey<SwimlaneSeries>> = {
            [SortBy.custom]: (series): number =>
                this.selectionArray.selectedEntityNames.indexOf(
                    series.entityName
                ),
            [SortBy.entityName]: (series): string => series.entityName,
            [SortBy.firstCategory]: sortByCategory({
                series: this.unsortedSeries,
                boundary: "first",
                categories,
            }),
            [SortBy.lastCategory]: sortByCategory({
                series: this.unsortedSeries,
                boundary: "last",
                categories,
            }),
        }

        return sortByConfig(this.unsortedSeries, this.sortConfig, keyFns)
    }

    @computed get availableSortKeys(): SwimlaneSortKey[] {
        return [...SWIMLANE_SORT_KEYS]
    }

    @computed get defaultSortKey(): SwimlaneSortKey {
        return SortBy.lastCategory
    }

    @computed get rankedSwimlane(): RankedSwimlane | undefined {
        return toRankedSwimlane({
            series: this.series,
            categories: this.categories,
        })
    }

    toHorizontalAxis(config: AxisConfig): HorizontalAxis {
        const axis = config.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([
            R.first(this.timesAsc),
            R.last(this.timesAsc),
        ])
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies = [FacetStrategy.none]

        if (
            this.categories?.kind === "ordinal" &&
            this.selectionArray.numSelectedEntities > 1
        )
            strategies.push(FacetStrategy.entity)

        return strategies
    }

    @computed get errorInfo(): ChartErrorInfo {
        const message = getDefaultFailMessage(this.manager)
        if (message) return { reason: message }

        if (this.yColumnSlugs.length > 1)
            return { reason: "Only one indicator can be shown at a time" }

        if (!this.categories)
            return { reason: "Requires an indicator with categorical values" }

        return { reason: "" }
    }
}
