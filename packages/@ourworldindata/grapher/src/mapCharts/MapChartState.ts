import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import {
    ChoroplethSeries,
    ChoroplethSeriesByName,
    MapChartManager,
    MapColumnInfo,
} from "./MapChartConstants"
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
    Time,
} from "@ourworldindata/types"
import {
    checkHasMembers,
    isPresent,
    mappableCountries,
    regions,
} from "@ourworldindata/utils"
import { MapConfig } from "./MapConfig"
import { combineHistoricalAndProjectionColumns } from "../chart/ChartUtils"
import { isOnTheMap } from "./MapHelpers"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"

export class MapChartState implements ChartState, ColorScaleManager {
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
        // Drop non-mappable entities from the table
        table = this.dropNonMapEntities(table)

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
            .interpolateColumnWithTolerance(
                mapColumnInfo.slug,
                this.mapConfig.timeTolerance,
                this.mapConfig.toleranceStrategy
            )
    }

    private transformTableForCombinedMapColumn(
        table: OwidTable,
        mapColumnInfo: Extract<MapColumnInfo, { type: "historical+projected" }>
    ): OwidTable {
        const { historicalSlug, projectedSlug, combinedSlug } = mapColumnInfo

        // Interpolate both columns separately
        table = table
            .interpolateColumnWithTolerance(
                projectedSlug,
                this.mapConfig.timeTolerance,
                this.mapConfig.toleranceStrategy
            )
            .interpolateColumnWithTolerance(
                historicalSlug,
                this.mapConfig.timeTolerance,
                this.mapConfig.toleranceStrategy
            )

        // Combine the projection column with its historical stem into one column
        table = combineHistoricalAndProjectionColumns(table, mapColumnInfo, {
            shouldAddIsProjectionColumn: true,
        })

        // Drop rows with error values for the combined column
        table = table.dropRowsWithErrorValuesForColumn(combinedSlug)

        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        table = this.addMissingMapEntities(table)
        table = this.dropNonMapEntitiesForSelection(table)
        table = this.dropAntarctica(table)
        return table
    }

    private dropAntarctica(table: OwidTable): OwidTable {
        // We prefer to not offer Antarctica in the entity selector on the map
        // tab to avoid confusion since it's shown on the globe, but not on the map.
        return table.filterByEntityNamesUsingIncludeExcludePattern({
            excluded: ["Antarctica"],
        })
    }

    private dropNonMapEntities(table: OwidTable): OwidTable {
        const entityNamesToSelect =
            table.availableEntityNames.filter(isOnTheMap)
        return table.filterByEntityNames(entityNamesToSelect)
    }

    private dropNonMapEntitiesForSelection(table: OwidTable): OwidTable {
        const { selectionArray } = this

        const allMappableCountryNames = mappableCountries.map((c) => c.name)
        const allRegionNames = regions
            .filter((r) => checkHasMembers(r) && r.code !== "OWID_WRL")
            .map((r) => r.name)

        // if no regions are currently selected, keep all mappable countries and regions
        if (!selectionArray.hasRegions) {
            return table.filterByEntityNames([
                ...allRegionNames,
                ...allMappableCountryNames,
            ])
        }

        return table.filterByEntityNames(
            R.unique([
                // keep all regions
                ...allRegionNames,
                // only keep those countries that are within the selected regions
                ...selectionArray.countryNamesForSelectedRegions,
                // keep the user's selection
                ...selectionArray.selectedEntityNames,
            ])
        )
    }

    private addMissingMapEntities(table: OwidTable): OwidTable {
        // the given table might not have data for all mappable countries, but
        // on the map tab, we do want every country to be selectable, even if
        // it doesn't have data for any of the years. that's why we add a
        // missing-data row for every mappable country that isn't in the table

        const missingMappableCountries = mappableCountries.filter(
            (country) => !table.availableEntityNameSet.has(country.name)
        )

        const rows = missingMappableCountries.map((country) => ({
            entityName: country.name,
            time: table.maxTime!, // arbitrary time
            value: ErrorValueTypes.MissingValuePlaceholder,
        }))
        table = table.appendRows(
            rows,
            `Append rows for mappable countries without data: ${rows.map((row) => row.entityName).join(", ")}`
        )

        return table
    }

    @computed get inputTable(): OwidTable {
        const { mapColumnInfo } = this
        const { table } = this.manager

        // For historical+projected data, we need to create the combined column
        // on the input table. This ensures the color scale has access to the
        // complete range of data across both columns
        return mapColumnInfo.type === "historical+projected"
            ? combineHistoricalAndProjectionColumns(table, mapColumnInfo)
            : table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get selectionArray(): MapSelectionArray {
        return this.mapConfig.selection
    }

    @computed get mapColumn(): CoreColumn {
        return this.transformedTable.get(this.mapColumnSlug)
    }

    @computed get mapColumnInfo(): MapColumnInfo {
        const mapColumnSlug = this.manager.mapColumnSlug!

        // If projection info is available, then we can stitch together the
        // historical and projected columns
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

    // The map column without tolerance and timeline filtering applied
    @computed get mapColumnUntransformed(): CoreColumn {
        return this.dropNonMapEntities(this.inputTable).get(this.mapColumnSlug)
    }

    @computed get colorScaleConfig(): ColorScaleConfig {
        return (
            ColorScaleConfig.fromDSL(this.mapColumn.def) ??
            this.mapConfig.colorScale
        )
    }

    @computed get colorScaleColumn(): CoreColumn {
        // Use the table before any transforms to collect all possible values over time.
        // Otherwise the legend changes as you slide the timeline handle.
        return this.mapColumnUntransformed
    }

    @computed get hasProjectedData(): boolean {
        return this.mapColumnInfo.type !== "historical"
    }

    @computed get hasProjectedDataBin(): boolean {
        return this.hasProjectedData
    }

    @computed get targetTime(): number | undefined {
        return this.manager.endTime
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

    @computed get series(): ChoroplethSeries[] {
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
                    time: originalTime,
                    value,
                    color,
                    isProjection,
                } satisfies ChoroplethSeries
            })
            .filter(isPresent)
    }

    @computed get seriesMap(): ChoroplethSeriesByName {
        return new Map(this.series.map((series) => [series.seriesName, series]))
    }

    @computed get formatTooltipValueIfCustom(): (
        d: PrimitiveType
    ) => string | undefined {
        const { mapConfig, colorScale } = this

        return (d: PrimitiveType): string | undefined => {
            if (!mapConfig.tooltipUseCustomLabels) return undefined
            // Find the bin (and its label) that this value belongs to
            const bin = colorScale.getBinForValue(d)
            const label = bin?.label
            if (label !== undefined && label !== "") return label
            else return undefined
        }
    }

    @computed get errorInfo(): ChartErrorInfo {
        if (this.mapColumn.isMissing) return { reason: "Missing map column" }
        return { reason: "" }
    }
}
