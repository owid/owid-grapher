import * as R from "remeda"
import { match } from "ts-pattern"
import { computed, makeObservable } from "mobx"
import {
    ChartErrorInfo,
    ColorScaleConfigInterface,
    ColorSchemeName,
    ColumnSlug,
    ScaleType,
    SortBy,
    SortConfig,
    SortOrder,
    Time,
} from "@ourworldindata/types"
import {
    OwidTable,
    CoreColumn,
    ColumnTypeMap,
} from "@ourworldindata/core-table"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getShortNameForEntity,
    makeSelectionArray,
    SortKey,
    keepInputOrder,
    sortByConfig,
} from "../chart/ChartUtils"
import { OWID_ERROR_COLOR } from "../color/ColorConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { AxisConfig } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import {
    SwimlaneSegment,
    isSwimlaneSortKey,
    SWIMLANE_SORT_KEYS,
    SwimlaneCategoryKind,
    SwimlaneChartManager,
    SwimlaneObservation,
    SwimlaneSeries,
    SwimlaneSortKey,
} from "./SwimlaneChartConstants"
import { toRawSwimlaneSegments } from "./SwimlaneChartHelpers"

export class SwimlaneChartState implements ChartState, ColorScaleManager {
    manager: SwimlaneChartManager

    colorScale: ColorScale
    hasNoDataBin = true

    constructor({ manager }: { manager: SwimlaneChartManager }) {
        this.manager = manager
        this.colorScale = new ColorScale(this)
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
        if (!this.yColumnSlug) return table

        return table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )
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

    @computed get inputYColumn(): CoreColumn {
        return this.inputTable.get(this.yColumnSlug)
    }

    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumn
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

    @computed get categoryKind(): SwimlaneCategoryKind | undefined {
        const column = this.colorScaleColumn
        if (!(column instanceof ColumnTypeMap.String)) return undefined
        return column instanceof ColumnTypeMap.Ordinal
            ? "ordinal"
            : "categorical"
    }

    @computed get defaultBaseColorScheme(): ColorSchemeName {
        return this.categoryKind === "ordinal"
            ? ColorSchemeName.SingleColorGradientDenim
            : ColorSchemeName.OwidCategoricalA
    }

    @computed private get timesAsc(): Time[] {
        const { startTime, endTime } = this.manager
        if (startTime === undefined || endTime === undefined) return []
        return R.range(startTime, endTime + 1)
    }

    @computed get defaultSortConfig(): SortConfig {
        return { sortBy: SortBy.entityName, sortOrder: SortOrder.asc }
    }

    @computed get sortConfig(): SortConfig {
        const { sortBy, sortOrder } = this.manager.sortConfig ?? {}
        if (sortBy && isSwimlaneSortKey(sortBy)) return { sortBy, sortOrder }
        return this.defaultSortConfig
    }

    @computed get availableSortKeys(): SwimlaneSortKey[] {
        return [...SWIMLANE_SORT_KEYS]
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
                    .filter((row) => row.value !== "")
                    .map((row) => ({ time: row.time, category: row.value }))

                const segments: SwimlaneSegment[] = toRawSwimlaneSegments({
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

                const lastCategorySegment = R.findLast(
                    segments,
                    (segment) => segment.kind === "category"
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

    @computed get series(): SwimlaneSeries[] {
        const keyFns: Record<SwimlaneSortKey, SortKey<SwimlaneSeries>> = {
            [SortBy.custom]: keepInputOrder,
            [SortBy.entityName]: (series): string => series.entityName,
        }

        return sortByConfig(this.unsortedSeries, this.sortConfig, keyFns)
    }

    toHorizontalAxis(config: AxisConfig): HorizontalAxis {
        const axis = config.toHorizontalAxis()
        const lastTime = R.last(this.timesAsc)
        // The last segment runs one step past the last time
        axis.updateDomainPreservingUserSettings([
            R.first(this.timesAsc),
            lastTime === undefined ? undefined : lastTime + 1,
        ])
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed get errorInfo(): ChartErrorInfo {
        const message = getDefaultFailMessage(this.manager)
        if (message) return { reason: message }

        if (this.yColumnSlugs.length > 1)
            return { reason: "Only one indicator can be shown at a time" }

        if (!this.categoryKind)
            return { reason: "Requires an indicator with categorical values" }

        const { entityTypePlural = "entities" } = this.manager
        const hasCategorySegment = this.series.some((series) =>
            series.segments.some((segment) => segment.kind === "category")
        )
        if (!hasCategorySegment)
            return { reason: `No data for the selected ${entityTypePlural}` }

        return { reason: "" }
    }
}
