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
    ChoroplethSeries,
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
    InteractionState,
    MapRegionName,
    SeriesName,
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

export type MapChartProps = ChartComponentProps<MapChartState>

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
            hoverFeatureId: observable,
            hoverBracket: observable,
            tooltipState: observable,
        })
    }

    /** The id of the currently hovered feature/country */
    hoverFeatureId: string | undefined = undefined

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
        return this.chartState.targetTime
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get choroplethData(): ChoroplethSeriesByName {
        return this.seriesMap
    }

    base = createRef<SVGGElement>()
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
        this.manager.mapRegionDropdownValue = undefined
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

    @computed private get series(): ChoroplethSeries[] {
        return this.chartState.series
    }

    @computed private get seriesMap(): ChoroplethSeriesByName {
        const map = new Map<SeriesName, ChoroplethSeries>()
        this.series.forEach((series) => {
            map.set(series.seriesName, series)
        })
        return map
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

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

    @computed get choroplethMapBounds(): Bounds {
        return this.bounds.padBottom(this.legendHeight + 4)
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

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.legendData
            .filter((bin) => isCategoricalBin(bin))
            .map((bin) => this.maybeAddPatternRefToBin(bin))
    }

    @computed private get hasCategoricalLegendData(): boolean {
        return this.categoricalLegendData.length > 1
    }

    @computed get binColors(): string[] {
        return this.legendData.map((bin) => bin.color)
    }

    @computed private get numericHoverBracket(): ColorScaleBin | undefined {
        const { hoverBracket, hoverValue } = this
        const { numericLegendData } = this

        if (hoverBracket) return hoverBracket

        if (hoverValue !== undefined)
            return numericLegendData.find((bin) => bin.contains(hoverValue))

        return undefined
    }

    @computed private get categoricalHoverBracket():
        | CategoricalBin
        | undefined {
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

    @computed private get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed private get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height + 5 : 0
    }

    @computed private get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
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

    @computed private get renderUid(): number {
        return guid()
    }

    @computed private get clipPath(): ClipPath {
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
                        timeSeriesTable={this.chartState.inputTable}
                        formatValueIfCustom={
                            this.chartState.formatTooltipValueIfCustom
                        }
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
