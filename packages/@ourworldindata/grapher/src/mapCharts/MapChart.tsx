import {
    Bounds,
    getRelativeMouse,
    guid,
    exposeInstanceOnWindow,
    Color,
    HorizontalAlign,
} from "@ourworldindata/utils"
import { observable, computed, action, makeObservable } from "mobx"
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
import { CoreColumn } from "@ourworldindata/core-table"
import {
    GeoFeature,
    MapBracket,
    MapChartManager,
    DEFAULT_STROKE_COLOR,
    ChoroplethSeriesByName,
    ChoroplethMapManager,
    MAP_CHART_CLASSNAME,
    MapColumnInfo,
    PROJECTED_DATA_LEGEND_COLOR,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { ColorScale } from "../color/ColorScale"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_MAX_TOOLTIP_WIDTH,
    Patterns,
} from "../core/GrapherConstants"
import { ChartInterface } from "../chart/ChartInterface"
import {
    CategoricalBin,
    ColorScaleBin,
    isCategoricalBin,
    isNoDataBin,
    isNumericBin,
    isProjectedDataBin,
    NumericBin,
} from "../color/ColorScaleBin"
import {
    ColumnSlug,
    GrapherVariant,
    MapRegionName,
} from "@ourworldindata/types"
import { ClipPath, makeClipPath } from "../chart/ChartUtils"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { Component, createRef } from "react"
import { ChoroplethMap } from "./ChoroplethMap"
import { ChoroplethGlobe } from "./ChoroplethGlobe"
import { GlobeController } from "./GlobeController"
import { MapRegionDropdownValue } from "../controls/MapRegionDropdown"
import { MapSelectionArray } from "../selection/MapSelectionArray.js"
import { match } from "ts-pattern"
import { makeProjectedDataPatternId } from "./MapComponents"
import { MapChartState } from "./MapChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { InteractionState } from "../interaction/InteractionState"

export type MapChartProps = ChartComponentProps<MapChartState>

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
    constructor(props: MapChartProps) {
        super(props)

        makeObservable(this, {
            hoverBracket: observable,
            tooltipState: observable,
        })
    }

    /**
     * The currently hovered map bracket.
     *
     * Hovering a map bracket highlights all countries within that bracket on the map.
     */
    hoverBracket: MapBracket | undefined = undefined

    tooltipState = new TooltipState<{
        featureId: string
    }>()

    @computed get chartState(): MapChartState {
        return this.props.chartState
    }

    @computed get selectionArray(): MapSelectionArray {
        return this.chartState.selectionArray
    }

    @computed get mapColumn(): CoreColumn {
        return this.chartState.mapColumn
    }

    @computed private get mapColumnSlug(): ColumnSlug {
        return this.chartState.mapColumnSlug
    }

    @computed private get mapColumnInfo(): MapColumnInfo {
        return this.chartState.mapColumnInfo
    }

    @computed get hasProjectedData(): boolean {
        return this.mapColumnInfo.type !== "historical"
    }

    @computed private get targetTime(): number | undefined {
        return this.manager.targetTime ?? this.manager.endTime
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get choroplethData(): ChoroplethSeriesByName {
        return this.chartState.seriesMap
    }

    base = createRef<SVGGElement>()
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

    @computed private get manager(): MapChartManager {
        return this.chartState.manager
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

    override componentWillUnmount(): void {
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
        return this.chartState.mapConfig
    }

    @action.bound onRegionChange(value: MapRegionName): void {
        this.mapConfig.region = value
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // hide the globe on hitting the Escape key
        if (e.key === "Escape" && this.mapConfig.globe.isActive) {
            this.globeController.hideGlobe()
            this.globeController.resetGlobe()
            this.mapConfig.region = MapRegionName.World
        }
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

    @computed private get disableIntroAnimation(): boolean {
        // The intro animation transitions from a neutral color to the actual color.
        // That doesn't work if a pattern is used to fill the country outlines,
        // which is the case for projected data.
        if (this.mapColumnInfo.type !== "historical") return true

        return !!this.manager.disableIntroAnimation
    }

    override componentDidMount(): void {
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
    @computed private get hoverValue(): string | number | undefined {
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
        return new InteractionState(
            isHovered,
            !!(this.hoverBracket || this.manager.externalLegendHoverBin)
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
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

    @computed private get region(): MapRegionName {
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
                this.chartState.transformedTable
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

    @computed private get numMembersPerCategoricalBinByIndex(): Map<
        number,
        number
    > {
        const { chartState, legendData } = this
        return new Map(
            legendData
                .filter((bin) => isCategoricalBin(bin))
                .map((bin) => {
                    const memberCount = chartState.series.filter((series) =>
                        bin.contains(series.value)
                    ).length
                    return [bin.index, memberCount]
                })
        )
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        let categoricalLegendData = this.legendData
            .filter((bin) => isCategoricalBin(bin))
            .map((bin) => this.maybeAddPatternRefToBin(bin))

        // Hide empty bins in thumbnails
        if (
            this.isStatic &&
            this.manager.variant === GrapherVariant.Thumbnail
        ) {
            categoricalLegendData = categoricalLegendData.filter((bin) => {
                const memberCount =
                    this.numMembersPerCategoricalBinByIndex.get(bin.index) ?? 0
                return (
                    isNoDataBin(bin) ||
                    isProjectedDataBin(bin) ||
                    memberCount > 0
                )
            })
        }

        return categoricalLegendData
    }

    @computed private get hasCategoricalLegendData(): boolean {
        return this.categoricalLegendData.length > 1
    }

    @computed get binColors(): string[] {
        return this.legendData.map((bin) => bin.color)
    }

    @computed private get numericHoverBracket(): ColorScaleBin | undefined {
        const { hoverBracket, hoverValue, numericLegendData } = this
        const { externalLegendHoverBin } = this.manager

        if (hoverBracket) return hoverBracket

        if (hoverValue !== undefined)
            return numericLegendData.find((bin) => bin.contains(hoverValue))

        return externalLegendHoverBin
    }

    @computed private get categoricalHoverBracket():
        | CategoricalBin
        | undefined {
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

    @computed private get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed private get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height : 0
    }

    @computed private get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        if (this.manager.isDisplayedAlongsideComplementaryTable)
            return undefined
        return this.manager.showLegend && this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        if (this.manager.isDisplayedAlongsideComplementaryTable)
            return undefined
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

    @computed private get renderUid(): number {
        return guid()
    }

    @computed private get clipPath(): ClipPath {
        return makeClipPath({
            renderUid: this.renderUid,
            box: this.choroplethMapBounds,
        })
    }

    @computed get numericBinSize(): number {
        return 0.625 * this.fontSize
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
                        timeSeriesTable={this.chartState.inputTable}
                        formatValueForTooltip={
                            this.chartState.formatValueForTooltip
                        }
                        manager={this.manager}
                        lineColorScale={this.colorScale}
                        targetTime={this.targetTime}
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

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return this.isStatic ? this.renderStatic() : this.renderInteractive()
    }
}
