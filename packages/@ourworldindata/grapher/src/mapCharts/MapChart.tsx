import React from "react"
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
    MAP_REGION_LABELS,
    MapViewport,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { ColorScale } from "../color/ColorScale"
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
    InteractionState,
    MapRegionName,
    SeriesName,
    ChartErrorInfo,
} from "@ourworldindata/types"
import { autoDetectYColumnSlugs, makeClipPath } from "../chart/ChartUtils"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { ChoroplethMap } from "./ChoroplethMap"
import { ChoroplethGlobe } from "./ChoroplethGlobe"
import { GlobeController } from "./GlobeController"
import { MapRegionDropdownValue } from "../controls/MapRegionDropdown"
import { getCountriesByRegion, isOnTheMap } from "./MapHelpers.js"
import { MapSelectionArray } from "../selection/MapSelectionArray.js"

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
    extends React.Component<MapChartProps>
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
        if (!table.has(this.mapColumnSlug)) return table

        table = this.dropNonMapEntities(table)
            .dropRowsWithErrorValuesForColumn(this.mapColumnSlug)
            .interpolateColumnWithTolerance(
                this.mapColumnSlug,
                this.mapConfig.timeTolerance,
                this.mapConfig.toleranceStrategy
            )

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

    @computed get mapColumnSlug(): string {
        return (
            this.manager.mapColumnSlug ??
            autoDetectYColumnSlugs(this.manager)[0]!
        )
    }

    @computed get mapColumn(): CoreColumn {
        return this.transformedTable.get(this.mapColumnSlug)
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

    base: React.RefObject<SVGGElement> = React.createRef()
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

    @computed get mapViewport(): MapViewport | undefined {
        return this.manager.mapViewport
    }

    @computed get isFaceted(): boolean | undefined {
        return this.manager.isFaceted
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

    @computed get series(): ChoroplethSeries[] {
        const { mapColumn, targetTime } = this
        if (mapColumn.isMissing) return []
        if (targetTime === undefined) return []

        return mapColumn.owidRows
            .map((row) => {
                const { entityName, value, originalTime } = row
                const color =
                    this.colorScale.getColor(value) || this.noDataColor
                return {
                    seriesName: entityName,
                    time: originalTime,
                    value,
                    color,
                }
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

    componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
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
        return this.colorScale.legendBins
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
        if (hoverBracket?.contains(series?.value)) return true
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

    @computed get numericLegendData(): ColorScaleBin[] {
        if (
            this.hasCategorical ||
            !this.legendData.some(
                (bin) =>
                    (bin as CategoricalBin).value === "No data" && !bin.isHidden
            )
        )
            return this.legendData.filter(
                (bin) => bin instanceof NumericBin && !bin.isHidden
            )

        const bins: ColorScaleBin[] = this.legendData.filter(
            (bin) =>
                (bin instanceof NumericBin || bin.value === "No data") &&
                !bin.isHidden
        )
        for (const bin of bins)
            if (bin instanceof CategoricalBin && bin.value === "No data")
                bin.props = {
                    ...bin.props,
                    patternRef: Patterns.noDataPattern,
                }

        return [bins[bins.length - 1], ...bins.slice(0, -1)]
    }

    @computed get hasNumeric(): boolean {
        return this.numericLegendData.length > 1
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        const bins = this.legendData.filter(
            (bin): bin is CategoricalBin =>
                bin instanceof CategoricalBin && !bin.isHidden
        )
        for (const bin of bins)
            if (bin.value === "No data")
                bin.props = {
                    ...bin.props,
                    patternRef: Patterns.noDataPattern,
                }
        return bins
    }

    @computed get hasCategorical(): boolean {
        return this.categoricalLegendData.length > 1
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
                        entityName={tooltipCountry}
                        timeseriesTable={this.inputTable}
                        position={tooltipState.position}
                        fading={tooltipState.fading}
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
