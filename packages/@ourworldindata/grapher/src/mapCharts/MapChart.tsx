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
    PrimitiveType,
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
} from "@ourworldindata/types"
import {
    ClipPath,
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
import { isOnTheMap } from "./MapHelpers.js"
import { MapSelectionArray } from "../selection/MapSelectionArray.js"
import { match, P } from "ts-pattern"
import { makeProjectedDataPatternId } from "./MapComponents"

interface MapChartProps {
    bounds?: Bounds
    manager: MapChartManager
    containerElement?: HTMLDivElement
}

@observer
export class MapChart
    extends Component<MapChartProps>
    implements
        ChartInterface,
        HorizontalColorLegendManager,
        ChoroplethMapManager
{
    /** The id of the currently hovered feature/country */
    @observable hoverFeatureId?: string

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

    @computed get failMessage(): string {
        if (this.mapColumn.isMissing) return "Missing map column"
        return ""
    }

    @computed private get mapColumnInfo(): MapColumnInfo {
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
        return this.manager.endTime
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
            this.hoverFeatureId = featureId
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
        this.hoverFeatureId = undefined
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
        this.manager.mapRegionDropdownValue = undefined
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

    @computed private get formatTooltipValueIfCustom(): (
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

    defaultBaseColorScheme = ColorSchemeName.BuGn
    hasNoDataBin = true

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // hide the globe on hitting the Escape key
        if (e.key === "Escape" && this.mapConfig.globe.isActive) {
            this.globeController.hideGlobe()
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
        if (!this.hoverFeatureId) return undefined

        const series = this.choroplethData.get(this.hoverFeatureId)
        if (!series) return "No data"

        return series.value
    }

    private isHovered(featureId: string): boolean {
        const { mapConfig, hoverFeatureId, hoverBracket } = this

        if (mapConfig.globe.focusCountry === featureId) return true

        if (hoverFeatureId === featureId) return true
        else if (!hoverBracket) return false

        const series = this.choroplethData.get(featureId)
        if (
            hoverBracket.contains(series?.value, {
                isProjection: series?.isProjection,
            })
        )
            return true
        else return false
    }

    isSelected(featureId: string): boolean {
        return this.selectionArray.selectedSet.has(featureId)
    }

    getHoverState(featureId: string): InteractionState {
        const isHovered = this.isHovered(featureId)
        return {
            active: isHovered,
            background: !!this.hoverBracket && !isHovered,
        }
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get noDataColor(): Color {
        return this.colorScale.noDataColor
    }

    @computed get choroplethMapBounds(): Bounds {
        return this.bounds.padBottom(this.legendHeight + 4)
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
        const { hoverBracket, hoverValue } = this
        const { numericLegendData } = this

        if (hoverBracket) return hoverBracket

        if (hoverValue !== undefined)
            return numericLegendData.find((bin) => bin.contains(hoverValue))

        return undefined
    }

    @computed get categoricalHoverBracket(): CategoricalBin | undefined {
        const { hoverBracket, hoverValue } = this
        const { categoricalLegendData } = this

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
        // it seems nice to have just a little bit of
        // extra padding left and right
        return this.bounds.width * 0.95
    }

    @computed get legendX(): number {
        return this.bounds.x + (this.bounds.width - this.legendMaxWidth) / 2
    }

    @computed get legendHeight(): number {
        return this.categoryLegendHeight + this.numericLegendHeight + 10
    }

    @computed get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height + 5 : 0
    }

    @computed get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegend(): HorizontalNumericColorLegend | undefined {
        return this.numericLegendData.length > 1
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get categoryLegendY(): number {
        const { categoryLegend, bounds, categoryLegendHeight } = this

        if (categoryLegend) return bounds.bottom - categoryLegendHeight
        return 0
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @computed get numericLegendY(): number {
        const {
            numericLegend,
            numericLegendHeight,
            bounds,
            categoryLegendHeight,
        } = this

        if (numericLegend)
            return (
                bounds.bottom - categoryLegendHeight - numericLegendHeight - 4
            )
        return 0
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed get clipPath(): ClipPath {
        return makeClipPath({
            renderUid: this.renderUid,
            box: this.choroplethMapBounds,
        })
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
                        formatValueIfCustom={this.formatTooltipValueIfCustom}
                        manager={this.manager}
                        lineColorScale={this.colorScale}
                        targetTime={this.targetTime}
                        sparklineWidth={sparklineWidth}
                        dismissTooltip={() => {
                            this.hoverFeatureId = undefined
                            this.tooltipState.target = null
                            this.globeController.dismissCountryFocus()
                        }}
                    />
                )}
            </g>
        )
    }

    render(): React.ReactElement {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
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
