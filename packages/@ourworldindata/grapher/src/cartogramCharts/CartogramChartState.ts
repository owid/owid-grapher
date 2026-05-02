import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import {
    ChoroplethSeries,
    MapChartManager,
    MapColumnInfo,
} from "../mapCharts/MapChartConstants"
import {
    CoreColumn,
    ErrorValueTypes,
    OwidTable,
} from "@ourworldindata/core-table"
import { match, P } from "ts-pattern"
import {
    ChartErrorInfo,
    Color,
    ColorSchemeName,
    ColumnSlug,
    EntityName,
    PrimitiveType,
    TickFormattingOptions,
    Time,
} from "@ourworldindata/types"
import { anyToString, isPresent } from "@ourworldindata/utils"
import { MapConfig } from "../mapCharts/MapConfig"
import { combineHistoricalAndProjectionColumns } from "../chart/ChartUtils"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { MapFormatValueForTooltip } from "../mapCharts/MapChartState"
import {
    CARTOGRAM_COUNTRY_CODE_TO_ENTITY_NAME,
    CARTOGRAM_DATA_ENTITY_OVERRIDES,
} from "./CartogramCountryCodes"

export interface CartogramSeries extends ChoroplethSeries {
    dataEntityName: EntityName
}

export type CartogramSeriesByName = Map<EntityName, CartogramSeries>

export class CartogramChartState implements ChartState, ColorScaleManager {
    manager: MapChartManager

    colorScale: ColorScale
    defaultBaseColorScheme = ColorSchemeName.BuGn
    hasNoDataBin = true

    constructor({ manager }: { manager: MapChartManager }) {
        this.manager = manager
        this.colorScale = new ColorScale(this)
        makeObservable(this)
    }

    transformTable(table: OwidTable): OwidTable {
        return match(this.mapColumnInfo)
            .with({ type: P.union("historical", "projected") }, (info) =>
                this.transformTableForSingleMapColumn(table, info)
            )
            .with({ type: "historical+projected" }, (info) =>
                this.transformTableForCombinedMapColumn(table, info)
            )
            .exhaustive()
    }

    private transformTableForSingleMapColumn(
        table: OwidTable,
        mapColumnInfo: Extract<
            MapColumnInfo,
            { type: "historical" | "projected" }
        >
    ): OwidTable {
        return table
            .dropRowsWithErrorValuesForColumn(mapColumnInfo.slug)
            .interpolateColumnWithTolerance(mapColumnInfo.slug, {
                toleranceOverride: this.mapConfig.timeTolerance,
                toleranceStrategyOverride: this.mapConfig.toleranceStrategy,
            })
    }

    private transformTableForCombinedMapColumn(
        table: OwidTable,
        mapColumnInfo: Extract<MapColumnInfo, { type: "historical+projected" }>
    ): OwidTable {
        const { historicalSlug, projectedSlug, combinedSlug } = mapColumnInfo

        table = table
            .interpolateColumnWithTolerance(projectedSlug, {
                toleranceOverride: this.mapConfig.timeTolerance,
                toleranceStrategyOverride: this.mapConfig.toleranceStrategy,
            })
            .interpolateColumnWithTolerance(historicalSlug, {
                toleranceOverride: this.mapConfig.timeTolerance,
                toleranceStrategyOverride: this.mapConfig.toleranceStrategy,
            })

        table = combineHistoricalAndProjectionColumns(table, mapColumnInfo, {
            shouldAddIsProjectionColumn: true,
        })

        return table.dropRowsWithErrorValuesForColumn(combinedSlug)
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        const cartogramEntityNames = Object.values(
            CARTOGRAM_COUNTRY_CODE_TO_ENTITY_NAME
        )
        const missingCartogramEntities = cartogramEntityNames.filter(
            (entityName) => !table.availableEntityNameSet.has(entityName)
        )

        const rows = missingCartogramEntities.map((entityName) => ({
            entityName,
            time: table.maxTime!,
            value: ErrorValueTypes.MissingValuePlaceholder,
        }))

        if (rows.length > 0) {
            table = table.appendRows(
                rows,
                `Append rows for cartogram entities without data: ${rows
                    .map((row) => row.entityName)
                    .join(", ")}`
            )
        }

        return table.filterByEntityNames([
            ...cartogramEntityNames,
            ...this.selectionArray.selectedEntityNames,
        ])
    }

    @computed get inputTable(): OwidTable {
        const { mapColumnInfo } = this
        const { table } = this.manager

        return mapColumnInfo.type === "historical+projected"
            ? combineHistoricalAndProjectionColumns(table, mapColumnInfo)
            : table
    }

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher

        if (this.manager.targetTime !== undefined) {
            table = table.filterByTargetTimes(
                [this.manager.targetTime],
                this.mapConfig.timeTolerance ??
                    table.get(this.mapColumnSlug).tolerance
            )
        }

        return table
    }

    @computed get selectionArray(): MapSelectionArray {
        return this.mapConfig.selection
    }

    @computed get mapColumn(): CoreColumn {
        return this.transformedTable.get(this.mapColumnSlug)
    }

    @computed get mapColumnInfo(): MapColumnInfo {
        const mapColumnSlug = this.manager.mapColumnSlug!

        const projectionInfo =
            this.manager.projectionColumnInfoBySlug?.get(mapColumnSlug)
        if (projectionInfo) {
            return {
                type: "historical+projected",
                slug: projectionInfo.combinedSlug,
                ...projectionInfo,
            }
        }

        const type = this.manager.table.get(mapColumnSlug).isProjection
            ? "projected"
            : "historical"

        return { type, slug: mapColumnSlug }
    }

    @computed get mapConfig(): MapConfig {
        return this.manager.mapConfig || new MapConfig()
    }

    @computed get mapColumnSlug(): ColumnSlug {
        return this.mapColumnInfo.slug
    }

    @computed get mapColumnUntransformed(): CoreColumn {
        return this.inputTable.get(this.mapColumnSlug)
    }

    @computed get colorScaleConfig(): ColorScaleConfig {
        return (
            ColorScaleConfig.fromDSL(this.mapColumn.def) ??
            this.mapConfig.colorScale
        )
    }

    @computed get colorScaleColumn(): CoreColumn {
        return this.mapColumnUntransformed
    }

    @computed get hasProjectedData(): boolean {
        return this.mapColumnInfo.type !== "historical"
    }

    @computed get hasProjectedDataBin(): boolean {
        return this.hasProjectedData
    }

    @computed get targetTime(): number | undefined {
        return this.manager.targetTime ?? this.manager.endTime
    }

    @computed get columnIsProjection(): CoreColumn | undefined {
        const slugForIsProjectionColumn =
            this.mapColumnInfo?.type === "historical+projected"
                ? this.mapColumnInfo.slugForIsProjectionColumn
                : undefined

        return slugForIsProjectionColumn
            ? this.transformedTable.get(slugForIsProjectionColumn)
            : undefined
    }

    private checkIsProjection(
        entityName: EntityName,
        originalTime: Time
    ): boolean {
        return match(this.mapColumnInfo.type)
            .with("historical", () => false)
            .with("projected", () => true)
            .with("historical+projected", () =>
                this.columnIsProjection?.valueByEntityNameAndOriginalTime
                    .get(entityName)
                    ?.get(originalTime)
            )
            .exhaustive()
    }

    @computed get noDataColor(): Color {
        return this.colorScale.noDataColor
    }

    @computed get series(): CartogramSeries[] {
        const { mapColumn, targetTime } = this
        if (mapColumn.isMissing) return []
        if (targetTime === undefined) return []

        return mapColumn.owidRows
            .map((row) => {
                const { entityName, value, originalTime } = row
                const color =
                    this.colorScale.getColor(value) || this.noDataColor
                const isProjection = this.checkIsProjection(
                    entityName,
                    originalTime
                )
                return {
                    seriesName: entityName,
                    dataEntityName: entityName,
                    time: originalTime,
                    value,
                    color,
                    isProjection,
                } satisfies CartogramSeries
            })
            .filter(isPresent)
    }

    @computed get seriesMap(): CartogramSeriesByName {
        return new Map(this.series.map((series) => [series.seriesName, series]))
    }

    getSeriesForCartogramEntity(
        cartogramEntityName: EntityName
    ): CartogramSeries | undefined {
        const ownSeries = this.seriesMap.get(cartogramEntityName)
        if (ownSeries) return ownSeries

        const dataEntityName =
            CARTOGRAM_DATA_ENTITY_OVERRIDES[cartogramEntityName]
        if (!dataEntityName) return undefined

        const parentSeries = this.seriesMap.get(dataEntityName)
        if (!parentSeries) return undefined

        return {
            ...parentSeries,
            seriesName: cartogramEntityName,
            dataEntityName,
        }
    }

    @computed get formatValueForTooltip(): MapFormatValueForTooltip {
        const { mapConfig, colorScale } = this

        return (d: PrimitiveType, options?: TickFormattingOptions) => {
            if (mapConfig.tooltipUseCustomLabels) {
                const bin = colorScale.getBinForValue(d)
                const label = bin?.label
                if (label !== undefined && label !== "")
                    return { label, isCategorical: true }
            }

            if (typeof d === "number") {
                const label = this.mapColumn.formatValueShort(d, options)
                return { label, isCategorical: false }
            } else {
                return { label: anyToString(d), isCategorical: true }
            }
        }
    }

    @computed get errorInfo(): ChartErrorInfo {
        if (this.mapColumn.isMissing) return { reason: "Missing map column" }
        return { reason: "" }
    }
}
