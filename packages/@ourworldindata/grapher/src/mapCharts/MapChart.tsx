import React from "react"
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
import { isOnTheMap } from "./EntitiesOnTheMap"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import {
    GeoFeature,
    MapBracket,
    MapChartManager,
    MapEntity,
    ChoroplethSeries,
    DEFAULT_STROKE_COLOR,
    ChoroplethSeriesByName,
    ChoroplethMapManager,
    MAP_CHART_CLASSNAME,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
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
    MapRegionName,
    GRAPHER_TAB_OPTIONS,
    SeriesName,
    EntityName,
} from "@ourworldindata/types"
import {
    autoDetectYColumnSlugs,
    makeClipPath,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { SelectionArray } from "../selection/SelectionArray"
import { ChoroplethMap } from "./ChoroplethMap"
import { ChoroplethGlobe } from "./ChoroplethGlobe"

interface MapChartProps {
    bounds?: Bounds
    manager: MapChartManager
    containerElement?: HTMLDivElement
}

@observer
export class MapChart
    extends React.Component<MapChartProps>
    implements
        ChartInterface,
        HorizontalColorLegendManager,
        ColorScaleManager,
        ChoroplethMapManager
{
    @observable focusEntity?: MapEntity
    @observable focusBracket?: MapBracket
    @observable tooltipState = new TooltipState<{
        featureId: string
        clickable: boolean
    }>()

    transformTable(table: OwidTable): OwidTable {
        if (!table.has(this.mapColumnSlug)) return table
        const transformedTable = this.dropNonMapEntities(table)
            .dropRowsWithErrorValuesForColumn(this.mapColumnSlug)
            .interpolateColumnWithTolerance(
                this.mapColumnSlug,
                this.mapConfig.timeTolerance,
                this.mapConfig.toleranceStrategy
            )
        return transformedTable
    }

    private dropNonMapEntities(table: OwidTable): OwidTable {
        const entityNamesToSelect =
            table.availableEntityNames.filter(isOnTheMap)
        return table.filterByEntityNames(entityNamesToSelect)
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

    @computed get failMessage(): string {
        if (this.mapColumn.isMissing) return "Missing map column"
        return ""
    }

    @computed get mapColumnSlug(): string {
        return (
            this.manager.mapColumnSlug ??
            autoDetectYColumnSlugs(this.manager)[0]!
        )
    }

    @computed private get mapColumn(): CoreColumn {
        return this.transformedTable.get(this.mapColumnSlug)
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

    base: React.RefObject<SVGGElement> = React.createRef()
    @action.bound onMapMouseOver(feature: GeoFeature): void {
        const series =
            feature.id === undefined
                ? undefined
                : this.seriesMap.get(feature.id as string)
        this.focusEntity = {
            id: feature.id,
            series: series || { value: "No data" },
        }

        if (feature.id !== undefined) {
            const featureId = feature.id as string,
                clickable = this.isEntityClickable(featureId)
            this.tooltipState.target = { featureId, clickable }
        }
    }

    @action.bound onMapMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager?.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound onMapMouseLeave(): void {
        this.focusEntity = undefined
        this.tooltipState.target = null
    }

    @computed get manager(): MapChartManager {
        return this.props.manager
    }

    @computed private get entityNamesWithData(): Set<EntityName> {
        // We intentionally use `inputTable` here instead of `transformedTable`, because of countries where there is no data
        // available in the map view for the current year, but data might still be available for other chart types
        return this.inputTable.entitiesWith([this.mapColumnSlug])
    }

    // Determine if we can go to line chart by clicking on a given map entity
    private isEntityClickable(entityName?: EntityName): boolean {
        if (!this.manager.mapIsClickable || !entityName) return false
        return this.entityNamesWithData.has(entityName)
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @action.bound onClick(d: GeoFeature, ev: MouseEvent): void {
        const entityName = d.id as EntityName
        if (!this.isEntityClickable(entityName)) return

        if (!ev.shiftKey) {
            this.selectionArray.setSelectedEntities([entityName])
            this.manager.tab = GRAPHER_TAB_OPTIONS.chart
            if (
                this.manager.isLineChartThatTurnedIntoDiscreteBar &&
                this.manager.hasTimeline
            ) {
                this.manager.resetHandleTimeBounds?.()
            }
        } else this.selectionArray.toggleSelection(entityName)
    }

    componentWillUnmount(): void {
        this.onMapMouseLeave()
        this.onLegendMouseLeave()
    }

    @action.bound onLegendMouseOver(bracket: MapBracket): void {
        this.focusBracket = bracket
    }

    @action.bound onLegendMouseLeave(): void {
        this.focusBracket = undefined
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

    @computed get series(): ChoroplethSeries[] {
        const { mapColumn, selectionArray, targetTime } = this
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
                    isSelected: selectionArray.selectedSet.has(entityName),
                    color,
                    highlightFillColor: color,
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

    defaultBaseColorScheme = ColorSchemeName.BuGn
    hasNoDataBin = true

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
    }

    @computed get legendData(): ColorScaleBin[] {
        return this.colorScale.legendBins
    }

    @computed get equalSizeBins(): boolean | undefined {
        return this.colorScale.config.equalSizeBins
    }

    @computed get focusValue(): string | number | undefined {
        return this.focusEntity?.series?.value
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

    @computed get numericFocusBracket(): ColorScaleBin | undefined {
        const { focusBracket, focusValue } = this
        const { numericLegendData } = this

        if (focusBracket) return focusBracket

        if (focusValue !== undefined)
            return numericLegendData.find((bin) => bin.contains(focusValue))

        return undefined
    }

    @computed get categoricalFocusBracket(): CategoricalBin | undefined {
        const { focusBracket, focusValue } = this
        const { categoricalLegendData } = this
        if (focusBracket && focusBracket instanceof CategoricalBin)
            return focusBracket

        if (focusValue !== undefined)
            return categoricalLegendData.find((bin) => bin.contains(focusValue))

        return undefined
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

        return (
            <g
                ref={this.base}
                className={MAP_CHART_CLASSNAME}
                onMouseMove={this.onMapMouseMove}
            >
                {this.renderMapOrGlobe()}
                {this.renderMapLegend()}
                {tooltipState.target && (
                    <MapTooltip
                        tooltipState={tooltipState}
                        timeSeriesTable={this.inputTable}
                        formatValueIfCustom={this.formatTooltipValueIfCustom}
                        manager={this.manager}
                        colorScaleManager={this}
                        targetTime={this.targetTime}
                        sparklineWidth={sparklineWidth}
                        dismissTooltip={() => {
                            this.tooltipState.target = null
                            this.focusEntity = undefined
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
