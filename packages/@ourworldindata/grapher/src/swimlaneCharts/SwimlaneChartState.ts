import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import {
    ChartErrorInfo,
    ColorScaleConfigInterface,
    ColorSchemeName,
    ColumnSlug,
    FacetStrategy,
    JsTypes,
    Time,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import {
    SwimlaneCategories,
    SwimlaneChartManager,
    SwimlaneSeries,
    SwimlaneSeriesSegment,
} from "./SwimlaneChartConstants"
import { SwimlaneObservation, toSwimlaneSegments } from "./swimlaneSegments"

export class SwimlaneChartState implements ChartState, ColorScaleManager {
    manager: SwimlaneChartManager

    colorScale: ColorScale
    defaultBaseColorScheme = ColorSchemeName.OwidCategoricalA
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

    /**
     * replaceNonNumericCellsWithErrorValues, which every numeric chart state
     * calls here, would discard the y column's category names
     */
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

    @computed get categories(): SwimlaneCategories | undefined {
        const column = this.colorScaleColumn
        if (column.isMissing || column.jsType !== JsTypes.string)
            return undefined

        const values: string[] = column.sortedUniqNonEmptyStringVals.filter(
            (value: string) => !this.colorScale.customHiddenCategories[value]
        )
        return column.allowedValuesSorted
            ? { kind: "ordinal", values }
            : { kind: "categorical", values }
    }

    @computed private get timesInSelectedRangeAsc(): Time[] {
        const { startTime, endTime } = this.manager
        return this.inputYColumn.uniqTimesAsc.filter(
            (time) =>
                (startTime === undefined || time >= startTime) &&
                (endTime === undefined || time <= endTime)
        )
    }

    @computed get series(): SwimlaneSeries[] {
        if (this.yColumn.isMissing) return []

        const { yColumn, timesInSelectedRangeAsc, colorScale } = this

        return this.selectionArray.selectedEntityNames.map(
            (entityName): SwimlaneSeries => {
                const rowsByTime =
                    yColumn.owidRowByEntityNameAndTime.get(entityName)

                const observations: SwimlaneObservation[] = rowsByTime
                    ? Array.from(rowsByTime.entries())
                          .filter(
                              ([, row]) =>
                                  typeof row.value === "string" &&
                                  row.value !== ""
                          )
                          .map(([time, row]) => ({
                              time,
                              category: row.value as string,
                          }))
                    : []

                const segments: SwimlaneSeriesSegment[] = toSwimlaneSegments({
                    observations,
                    columnTimesAsc: timesInSelectedRangeAsc,
                }).map((segment) =>
                    segment.kind === "category"
                        ? {
                              ...segment,
                              color:
                                  colorScale.getColor(segment.category) ??
                                  colorScale.noDataColor,
                          }
                        : segment
                )

                const lastCategorySegment = R.last(
                    segments.filter((segment) => segment.kind === "category")
                )

                return {
                    seriesName: entityName,
                    color: lastCategorySegment?.color ?? colorScale.noDataColor,
                    segments,
                }
            }
        )
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        return [FacetStrategy.none]
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
