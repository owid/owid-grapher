import * as R from "remeda"
import {
    Bounds,
    DEFAULT_BOUNDS,
    getRelativeMouse,
    guid,
    exposeInstanceOnWindow,
    isPresent,
    Color,
    HorizontalAlign,
    mappableCountries,
    regions,
    checkHasMembers,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { select } from "d3-selection"
import { easeCubic } from "d3-ease"
import { MapTooltip } from "./MapTooltip"
import { TooltipState } from "../tooltip/Tooltip.js"
import {
    OwidTable,
    CoreColumn,
    ErrorValueTypes,
} from "@ourworldindata/core-table"
import {
    GeoFeature,
    MapBracket,
    MapChartManager,
    ChoroplethSeries,
    DEFAULT_STROKE_COLOR,
    ChoroplethSeriesByName,
    ChoroplethMapManager,
    MAP_CHART_CLASSNAME,
    MapColumnInfo,
    PROJECTED_DATA_LEGEND_COLOR,
    MAP_REGION_LABELS,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import {
    ColorScale,
    NO_DATA_LABEL,
    PROJECTED_DATA_LABEL,
} from "../color/ColorScale"
import {
    BASE_FONT_SIZE,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_MAX_TOOLTIP_WIDTH,
    Patterns,
} from "../core/GrapherConstants"
import { ChartInterface } from "../chart/ChartInterface"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "../color/ColorScaleBin"
import {
    ColorSchemeName,
    ColumnSlug,
    EntityName,
    InteractionState,
    MapRegionName,
    SeriesName,
    Time,
    ChartErrorInfo,
} from "@ourworldindata/types"
import {
    combineHistoricalAndProjectionColumns,
    makeClipPath,
} from "../chart/ChartUtils"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { Component, createRef } from "react"
import { ChoroplethMap } from "./ChoroplethMap"
import { ChoroplethGlobe } from "./ChoroplethGlobe"
import { GlobeController } from "./GlobeController"
import { MapRegionDropdownValue } from "../controls/MapRegionDropdown"
import { getCountriesByRegion, isOnTheMap } from "./MapHelpers.js"
import { MapSelectionArray } from "../selection/MapSelectionArray.js"
import { match, P } from "ts-pattern"
import { makeProjectedDataPatternId } from "./MapComponents"

interface MapChartProps {
    bounds?: Bounds
    manager: MapChartManager
    containerElement?: HTMLDivElement
}

export const PADDING_BETWEEN_MAP_AND_LEGEND = 8
export const PADDING_BELOW_MAP_LEGEND = 4
export const PADDING_BETWEEN_MAP_LEGENDS = 4
export const MAP_LEGEND_MAX_WIDTH_RATIO = 0.95

@observer
export class MapChart
    extends Component<MapChartProps>
    implements
        ChartInterface,
        HorizontalColorLegendManager,
        ChoroplethMapManager
{
    /**
     * The currently hovered map bracket.
     *
     * Hovering a map bracket highlights all countries within that bracket on the map.
     */
    @observable hoverBracket?: MapBracket

    @observable tooltipState = new TooltipState<{ featureId: string }>()

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
        const { selectionArray, mapConfig } = this

        const allMappableCountryNames = mappableCountries.map((c) => c.name)
        const allRegionNames = regions
            .filter((r) => checkHasMembers(r) && r.code !== "OWID_WRL")
            .map((r) => r.name)

        const mappableCountryNameSet = new Set(allMappableCountryNames)

        // If in 2D mode and a continent is selected, then all countries
        // outside of the selected continent are disabled on the map
        // and thus also not selectable
        if (this.mapConfig.is2dContinentActive()) {
            const countriesInRegionSet = getCountriesByRegion(
                MAP_REGION_LABELS[mapConfig.region]
            )
            if (!countriesInRegionSet) return table

            const countriesInRegion = Array.from(countriesInRegionSet)
            const mappableCountriesInRegion = countriesInRegion.filter(
                (countryName) => mappableCountryNameSet.has(countryName)
            )

            return table.filterByEntityNames(
                R.unique([
                    // only keep countries in the region
                    ...mappableCountriesInRegion,
                    // keep the user's selection
                    ...selectionArray.selectedEntityNames,
                ])
            )
        }

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

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher

        // A target time is set for faceted maps
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

    @computed get errorInfo(): ChartErrorInfo {
        if (this.mapColumn.isMissing) return { reason: "Missing map column" }
        return { reason: "" }
    }

    @computed private get mapColumnInfo(): MapColumnInfo {
        const { mapColumnSlug, table } = this.manager

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

        const type = table.get(mapColumnSlug).isProjection
            ? "projected"
            : "historical"

        return { type, slug: mapColumnSlug }
    }

    @computed get mapColumnSlug(): ColumnSlug {
        return this.mapColumnInfo.slug
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

    @computed get mapColumn(): CoreColumn {
        return this.transformedTable.get(this.mapColumnSlug)
    }

    @computed get hasProjectedData(): boolean {
        return this.mapColumnInfo.type !== "historical"
    }

    @computed get hasProjectedDataBin(): boolean {
        return this.hasProjectedData
    }

    // The map column without tolerance and timeline filtering applied
    @computed private get mapColumnUntransformed(): CoreColumn {
        return this.dropNonMapEntities(this.inputTable).get(this.mapColumnSlug)
    }

    @computed private get targetTime(): number | undefined {
        return this.manager.targetTime ?? this.manager.endTime
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get choroplethData(): ChoroplethSeriesByName {
        return this.seriesMap
    }

    base: React.RefObject<SVGGElement> = createRef()
    @action.bound onMapMouseOver(feature: GeoFeature): void {
        if (feature.id !== undefined) {
            const featureId = feature.id as string
            this.mapConfig.hoverCountry = featureId
            this.tooltipState.target = { featureId }
            this.manager.logGrapherInteractionEvent?.(
                "map_country_hover",
                featureId
            )
        }
    }

    @action.bound onMapMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager?.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound onMapMouseLeave(): void {
        this.mapConfig.hoverCountry = undefined
        this.tooltipState.target = null
    }

    @computed get manager(): MapChartManager {
        return this.props.manager
    }

    @computed get globeController(): GlobeController {
        return this.manager.globeController ?? new GlobeController(this)
    }

    @computed get mapRegionDropdownValue(): MapRegionDropdownValue | undefined {
        return this.manager.mapRegionDropdownValue
    }

    @computed get isMapSelectionEnabled(): boolean {
        return !!this.manager.isMapSelectionEnabled
    }

    @action.bound resetMapRegionDropdownValue(): void {
        this.manager.resetMapRegionDropdownValue?.()
    }

    componentWillUnmount(): void {
        this.onMapMouseLeave()
        this.onLegendMouseLeave()
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    @action.bound onLegendMouseEnter(bracket: MapBracket): void {
        this.manager.logGrapherInteractionEvent?.(
            "map_legend_hover",
            bracket.label
        )
    }

    @action.bound onLegendMouseOver(bracket: MapBracket): void {
        this.hoverBracket = bracket
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoverBracket = undefined
    }

    @computed get mapConfig(): MapConfig {
        return this.manager.mapConfig || new MapConfig()
    }

    @action.bound onRegionChange(value: MapRegionName): void {
        this.mapConfig.region = value
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

    @computed private get seriesMap(): ChoroplethSeriesByName {
        const map = new Map<SeriesName, ChoroplethSeries>()
        this.series.forEach((series) => {
            map.set(series.seriesName, series)
        })
        return map
    }

    @computed get colorScaleColumn(): CoreColumn {
        // Use the table before any transforms to collect all possible values over time.
        // Otherwise the legend changes as you slide the timeline handle.
        return this.mapColumnUntransformed
    }

    colorScale = new ColorScale(this)

    @computed get colorScaleConfig(): ColorScaleConfig {
        return (
            ColorScaleConfig.fromDSL(this.mapColumn.def) ??
            this.mapConfig.colorScale
        )
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        const {
            numericLegendData,
            categoricalLegendData,
            categoricalBinStroke,
            legendMaxWidth,
        } = this
        if (!this.manager.showLegend)
            return {
                numericLegendData,
                categoricalLegendData,
                categoricalBinStroke,
                legendMaxWidth,
            }
        return undefined
    }

    defaultBaseColorScheme = ColorSchemeName.BuGn
    hasNoDataBin = true

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // hide the globe on hitting the Escape key
        if (e.key === "Escape" && this.mapConfig.globe.isActive) {
            this.globeController.hideGlobe()
            this.globeController.resetGlobe()
            this.mapConfig.region = MapRegionName.World
        }
    }

    @computed private get disableIntroAnimation(): boolean {
        // The intro animation transitions from a neutral color to the actual color.
        // That doesn't work if a pattern is used to fill the country outlines,
        // which is the case for projected data.
        if (this.mapColumnInfo.type !== "historical") return true

        return !!this.manager.disableIntroAnimation
    }

    componentDidMount(): void {
        if (!this.disableIntroAnimation) {
            select(this.base.current)
                .selectAll(`.${MAP_CHART_CLASSNAME} path`)
                .attr("data-fill", function () {
                    return (this as SVGPathElement).getAttribute("fill")
                })
                .attr("fill", this.colorScale.noDataColor)
                .transition()
                .duration(500)
                .ease(easeCubic)
                .attr("fill", function () {
                    return (this as SVGPathElement).getAttribute("data-fill")
                })
                .attr("data-fill", function () {
                    return (this as SVGPathElement).getAttribute("fill")
                })
        }
        exposeInstanceOnWindow(this)

        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    @computed private get legendData(): ColorScaleBin[] {
        return this.colorScale.legendBins.filter((bin) => !bin.isHidden)
    }

    /** The value of the currently hovered feature/country */
    @computed get hoverValue(): string | number | undefined {
        if (!this.mapConfig.hoverCountry) return undefined

        const series = this.choroplethData.get(this.mapConfig.hoverCountry)
        if (!series) return "No data"

        return series.value
    }

    private isHovered(featureId: string): boolean {
        const { mapConfig, hoverBracket } = this
        const { externalLegendHoverBin } = this.manager

        if (mapConfig.globe.focusCountry === featureId) return true

        if (mapConfig.hoverCountry === featureId) return true

        const series = this.choroplethData.get(featureId)
        if (
            hoverBracket?.contains(series?.value, {
                isProjection: series?.isProjection,
            })
        )
            return true
        if (externalLegendHoverBin?.contains(series?.value)) return true
        return false
    }

    isSelected(featureId: string): boolean {
        return this.selectionArray.selectedSet.has(featureId)
    }

    getHoverState(featureId: string): InteractionState {
        const isHovered = this.isHovered(featureId)
        return {
            active: isHovered,
            background:
                !!(this.hoverBracket || this.manager.externalLegendHoverBin) &&
                !isHovered,
        }
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get noDataColor(): Color {
        return this.colorScale.noDataColor
    }

    @computed get choroplethMapBounds(): Bounds {
        return this.bounds.padBottom(
            this.legendHeight
                ? this.legendHeight +
                      PADDING_BETWEEN_MAP_AND_LEGEND +
                      PADDING_BELOW_MAP_LEGEND
                : 0
        )
    }

    @computed get region(): MapRegionName {
        return this.mapConfig.region
    }

    @computed private get shouldAddProjectionPatternToLegendBins(): boolean {
        return match(this.mapColumnInfo)
            .with({ type: "historical" }, () => false)
            .with({ type: "projected" }, () => true)
            .with({ type: "historical+projected" }, (info) =>
                // Only add a pattern to the legend bins if _all_ values are projections.
                // If there is even a single non-projected (historical) value, the legend
                // should use solid colors.
                this.transformedTable
                    .get(info.slugForIsProjectionColumn)
                    .values.every((value) => value === true)
            )
            .exhaustive()
    }

    private maybeAddPatternRefToBin<Bin extends ColorScaleBin>(bin: Bin): Bin {
        if (isNoDataBin(bin))
            return new CategoricalBin({
                ...bin.props,
                patternRef: Patterns.noDataPattern,
            }) as Bin

        if (isProjectedDataBin(bin)) {
            const patternRef = makeProjectedDataPatternId(
                PROJECTED_DATA_LEGEND_COLOR,
                { forLegend: true }
            )
            return new CategoricalBin({ ...bin.props, patternRef }) as Bin
        }

        if (this.shouldAddProjectionPatternToLegendBins) {
            const patternRef = makeProjectedDataPatternId(bin.color, {
                forLegend: true,
            })
            return (
                bin instanceof CategoricalBin
                    ? new CategoricalBin({ ...bin.props, patternRef })
                    : new NumericBin({ ...bin.props, patternRef })
            ) as Bin
        }

        return bin
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        const hasNoDataBin = this.legendData.some((bin) => isNoDataBin(bin))
        if (this.hasCategoricalLegendData || !hasNoDataBin)
            return this.legendData
                .filter((bin) => isNumericBin(bin))
                .map((bin) => this.maybeAddPatternRefToBin(bin))

        const bins: ColorScaleBin[] = this.legendData
            .filter((bin) => isNumericBin(bin) || isNoDataBin(bin))
            .map((bin) => this.maybeAddPatternRefToBin(bin))

        // Move the no-data bin from the end to the start
        return [bins[bins.length - 1], ...bins.slice(0, -1)]
    }

    @computed get hasNumeric(): boolean {
        return this.numericLegendData.length > 1
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.legendData
            .filter((bin) => isCategoricalBin(bin))
            .map((bin) => this.maybeAddPatternRefToBin(bin))
    }

    @computed get hasCategoricalLegendData(): boolean {
        return this.categoricalLegendData.length > 1
    }

    @computed get binColors(): string[] {
        return this.legendData.map((bin) => bin.color)
    }

    @computed get numericHoverBracket(): ColorScaleBin | undefined {
        const { hoverBracket, hoverValue, numericLegendData } = this
        const { externalLegendHoverBin } = this.manager

        if (hoverBracket) return hoverBracket

        if (hoverValue !== undefined)
            return numericLegendData.find((bin) => bin.contains(hoverValue))

        return externalLegendHoverBin
    }

    @computed get categoricalHoverBracket(): CategoricalBin | undefined {
        const { hoverBracket, hoverValue, categoricalLegendData } = this

        if (hoverBracket && hoverBracket instanceof CategoricalBin)
            return hoverBracket

        if (hoverValue !== undefined)
            return categoricalLegendData.find((bin) => bin.contains(hoverValue))

        return undefined
    }

    // rename so that they're picked up by the legend component
    @computed get categoricalFocusBracket(): CategoricalBin | undefined {
        return this.categoricalHoverBracket
    }

    // rename so that they're picked up by the legend component
    @computed get numericFocusBracket(): ColorScaleBin | undefined {
        return this.numericHoverBracket
    }

    @computed get categoricalBinStroke(): Color {
        return DEFAULT_STROKE_COLOR
    }

    @computed get legendMaxWidth(): number {
        // it seems nice to have just a little bit of extra padding left and right
        return this.bounds.width * MAP_LEGEND_MAX_WIDTH_RATIO
    }

    @computed get legendX(): number {
        return this.bounds.x + (this.bounds.width - this.legendMaxWidth) / 2
    }

    @computed get legendHeight(): number {
        if (!this.manager.showLegend) return 0
        return this.categoryLegendHeight + this.numericLegendHeight
    }

    @computed get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height : 0
    }

    @computed get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.manager.showLegend && this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegend(): HorizontalNumericColorLegend | undefined {
        return this.manager.showLegend && this.numericLegendData.length > 1
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get categoryLegendY(): number {
        if (!this.categoryLegend) return 0
        return (
            this.bounds.bottom -
            this.categoryLegend.height -
            PADDING_BELOW_MAP_LEGEND
        )
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @computed get numericLegendY(): number {
        if (!this.numericLegend) return 0
        return (
            this.bounds.bottom -
            this.numericLegendHeight -
            PADDING_BELOW_MAP_LEGEND -
            // If present, the category legend is placed below the numeric legend
            (this.categoryLegend
                ? this.categoryLegendHeight + PADDING_BETWEEN_MAP_LEGENDS
                : 0)
        )
    }

    @computed get hoverColors(): Color[] | undefined {
        if (!this.hoverBracket) return undefined
        return [this.hoverBracket.color]
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed get clipPath(): { id: string; element: React.ReactElement } {
        return makeClipPath(this.renderUid, this.choroplethMapBounds)
    }

    renderMapLegend(): React.ReactElement {
        const { numericLegend, categoryLegend } = this

        return (
            <>
                {numericLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                {categoryLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
                )}
            </>
        )
    }

    renderMapOrGlobe({ clipping = true } = {}): React.ReactElement {
        const mapOrGlobe = this.mapConfig.globe.isActive ? (
            <ChoroplethGlobe manager={this} />
        ) : (
            <ChoroplethMap manager={this} />
        )

        if (!clipping) return mapOrGlobe

        return (
            <>
                {this.clipPath.element}
                <g clipPath={this.clipPath.id}>{mapOrGlobe}</g>
            </>
        )
    }

    renderStatic(): React.ReactElement {
        // Clipping the chart area is only necessary when the map is
        // zoomed in or we're showing the globe. If that isn't the case,
        // then we don't add a clipping element since it introduces noise
        // in SVG editing programs like Figma.
        const clipping =
            this.mapConfig.globe.isActive || this.region !== MapRegionName.World

        return (
            <>
                {this.renderMapOrGlobe({ clipping })}
                {this.renderMapLegend()}
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        const { tooltipState } = this

        let sparklineWidth: number | undefined
        if (this.manager.shouldPinTooltipToBottom) {
            sparklineWidth = Math.min(
                GRAPHER_MAX_TOOLTIP_WIDTH,
                this.bounds.width + (GRAPHER_FRAME_PADDING_HORIZONTAL - 1) * 2
            )
        }

        const tooltipCountry =
            tooltipState.target?.featureId ??
            // show a pinned-to-the-bottom tooltip when focused on a country
            (this.manager.shouldPinTooltipToBottom
                ? this.mapConfig.globe.focusCountry
                : undefined)

        return (
            <g
                ref={this.base}
                className={MAP_CHART_CLASSNAME}
                onMouseMove={this.onMapMouseMove}
            >
                {this.renderMapOrGlobe()}
                {this.renderMapLegend()}
                {tooltipCountry && (
                    <MapTooltip
                        mapColumnSlug={this.mapColumnSlug}
                        mapColumnInfo={this.mapColumnInfo}
                        entityName={tooltipCountry}
                        position={tooltipState.position}
                        fading={tooltipState.fading}
                        timeSeriesTable={this.inputTable}
                        shouldUseCustomLabels={
                            this.mapConfig.tooltipUseCustomLabels
                        }
                        manager={this.manager}
                        lineColorScale={this.colorScale}
                        targetTime={this.targetTime}
                        targetTimes={this.manager.highlightedTimesInTooltip}
                        sparklineWidth={sparklineWidth}
                        dismissTooltip={() => {
                            this.mapConfig.hoverCountry = undefined
                            this.tooltipState.target = null
                            this.globeController.dismissCountryFocus()
                        }}
                    />
                )}
            </g>
        )
    }

    render(): React.ReactElement {
        if (this.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.errorInfo.reason}
                />
            )

        return this.isStatic ? this.renderStatic() : this.renderInteractive()
    }
}

function isCategoricalBin(bin: ColorScaleBin): bin is CategoricalBin {
    return bin instanceof CategoricalBin
}

function isNumericBin(bin: ColorScaleBin): bin is NumericBin {
    return bin instanceof NumericBin
}

function isNoDataBin(bin: ColorScaleBin): bin is CategoricalBin {
    return isCategoricalBin(bin) && bin.value === NO_DATA_LABEL
}

function isProjectedDataBin(bin: ColorScaleBin): bin is CategoricalBin {
    return isCategoricalBin(bin) && bin.value === PROJECTED_DATA_LABEL
}
