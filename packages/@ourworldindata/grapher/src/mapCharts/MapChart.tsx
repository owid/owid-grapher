import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    ColorSchemeName,
    EntityName,
    GrapherTabOption,
    MapProjectionName,
    SeriesName,
} from "@ourworldindata/types"
import {
    Bounds,
    Color,
    DEFAULT_BOUNDS,
    HorizontalAlign,
    PointVector,
    PrimitiveType,
    anyToString,
    clamp,
    difference,
    exposeInstanceOnWindow,
    flatten,
    getRelativeMouse,
    getUserCountryInformation,
    guid,
    isNumber,
    isPresent,
    sortBy,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"
import { isElementInteractive } from "../core/GrapherUtils"
import {
    Quadtree,
    geoOrthographic,
    geoPath,
    geoCentroid,
    GeoPath,
    GeoPermissibleObjects,
    geoGraticule,
} from "d3"
import { easeCubic } from "d3-ease"
import { quadtree } from "d3-quadtree"
import { select } from "d3-selection"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import * as topojson from "topojson-client"
import { ChartInterface } from "../chart/ChartInterface"
import {
    autoDetectYColumnSlugs,
    makeClipPath,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "../color/ColorScaleBin"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_9_6,
    Patterns,
} from "../core/GrapherConstants"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { SelectionArray } from "../selection/SelectionArray"
import { TooltipState } from "../tooltip/Tooltip.js"
import { isOnTheMap } from "./EntitiesOnTheMap"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import {
    ChoroplethMapManager,
    ChoroplethSeries,
    DEFAULT_ROTATIONS,
    DEFAULT_VIEWPORT,
    GeoFeature,
    MAP_HOVER_TARGET_RANGE,
    MapBracket,
    MapChartManager,
    MapEntity,
    RenderFeature,
    VIEWPORTS,
    Viewport,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { MapProjectionGeos } from "./MapProjections"
import { MapTooltip } from "./MapTooltip"
import { MapTopology } from "./MapTopology"
import {
    WorldRegionName,
    WorldRegionToProjection,
} from "./WorldRegionsToProjection"
import { GlobeController } from "./GlobeController"

const DEFAULT_STROKE_COLOR = "#333"
const CHOROPLETH_MAP_CLASSNAME = "ChoroplethMap"

// TODO refactor to use transform pattern, bit too much info for a pure component

interface MapChartProps {
    bounds?: Bounds
    manager: MapChartManager
    containerElement?: HTMLDivElement
}

// Get the underlying geographical topology elements we're going to display
const GeoFeatures: GeoFeature[] = (
    topojson.feature(
        MapTopology as any,
        MapTopology.objects.world as any
    ) as any
).features

// Get the svg path specification string for every feature
const geoPathCache = new Map<MapProjectionName, string[]>()
const geoPathsFor = (projectionName: MapProjectionName): string[] => {
    if (geoPathCache.has(projectionName))
        return geoPathCache.get(projectionName)!

    // Use this context to round the path coordinates to a set number of decimal places
    const ctx = new GeoPathRoundingContext()
    const projectionGeo = MapProjectionGeos[projectionName].context(ctx)
    const strs = GeoFeatures.map((feature) => {
        ctx.beginPath() // restart the path
        projectionGeo(feature)
        return ctx.result()
    })

    projectionGeo.context(null) // reset the context for future calls

    geoPathCache.set(projectionName, strs)
    return geoPathCache.get(projectionName)!
}

// Get the bounding box for every geographical feature
const geoBoundsCache = new Map<MapProjectionName, Bounds[]>()
const geoBoundsFor = (projectionName: MapProjectionName): Bounds[] => {
    if (geoBoundsCache.has(projectionName))
        return geoBoundsCache.get(projectionName)!
    const projectionGeo = MapProjectionGeos[projectionName]
    const bounds = GeoFeatures.map((feature) => {
        const corners = projectionGeo.bounds(feature)

        const bounds = Bounds.fromCorners(
            new PointVector(...corners[0]),
            new PointVector(...corners[1])
        )

        // HACK (Mispy): The path generator calculates weird bounds for Fiji (probably it wraps around the map)
        if (feature.id === "Fiji")
            return bounds.set({
                x: bounds.right - bounds.height,
                width: bounds.height,
            })
        return bounds
    })

    geoBoundsCache.set(projectionName, bounds)
    return geoBoundsCache.get(projectionName)!
}

let centroidCache: PointVector[] = []
function centroids(): PointVector[] {
    if (centroidCache.length > 0) return centroidCache

    const centroids = GeoFeatures.map((geo) => {
        const centroid = geoCentroid(geo)
        return new PointVector(centroid[0], centroid[1])
    })

    centroidCache = centroids
    return centroids
}

// Bundle GeoFeatures with the calculated info needed to render them
const renderFeaturesCache = new Map<MapProjectionName, RenderFeature[]>()
const renderFeaturesFor = (
    projectionName: MapProjectionName
): RenderFeature[] => {
    if (renderFeaturesCache.has(projectionName))
        return renderFeaturesCache.get(projectionName)!
    const geoBounds = geoBoundsFor(projectionName)
    const geoPaths = geoPathsFor(projectionName)
    const unprojectedCentroids = centroids()
    const feats = GeoFeatures.map((geo, index) => ({
        id: geo.id as string,
        geo: geo,
        geoCentroid: unprojectedCentroids[index],
        path: geoPaths[index],
        bounds: geoBounds[index],
        center: geoBounds[index].centerPos,
    }))

    renderFeaturesCache.set(projectionName, feats)
    return renderFeaturesCache.get(projectionName)!
}

@observer
export class MapChart
    extends React.Component<MapChartProps>
    implements ChartInterface, HorizontalColorLegendManager, ColorScaleManager
{
    @observable focusEntity?: MapEntity
    @observable focusBracket?: MapBracket
    @observable tooltipState = new TooltipState<{
        featureId: string
        clickable: boolean
    }>()

    private persistFocusBracket = false

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

    @computed get choroplethData(): Map<SeriesName, ChoroplethSeries> {
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

    @action.bound onClickFeature(d: GeoFeature, ev: SVGMouseEvent): void {
        const entityName = d.id as EntityName
        if (!this.isEntityClickable(entityName)) return

        if (!ev.shiftKey) {
            this.selectionArray.setSelectedEntities([entityName])
            this.manager.tab = GrapherTabOption.chart
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

        if (this.manager.base?.current) {
            this.manager.base.current.removeEventListener(
                "mousedown",
                this.onGrapherClick
            )
        }
    }

    @computed get isGlobe(): boolean {
        return !!this.manager.isGlobe
    }

    @computed get globeRotation(): [number, number] {
        return this.manager.globeRotation ?? DEFAULT_VIEWPORT.rotation
    }

    @computed get globeController(): GlobeController {
        return this.manager.globeController ?? new GlobeController(this)
    }

    @action.bound onLegendMouseOver(bracket: MapBracket): void {
        this.focusBracket = bracket
    }

    @action.bound onLegendMouseLeave(): void {
        if (!this.persistFocusBracket) this.focusBracket = undefined
    }

    @action.bound onLegendClick(bracket: MapBracket): void {
        if (!this.isGlobe) return
        this.focusBracket = bracket
        this.persistFocusBracket = true
    }

    @action.bound onGrapherClick(e: Event): void {
        if (!this.isGlobe) return

        const target = e.target as HTMLElement

        let isWithinGlobe = false
        if (this.base.current) {
            const point = getRelativeMouse(this.base.current, e as MouseEvent)
            const bounds = this.choroplethMapBounds
            isWithinGlobe = PointVector.isPointInsideCircle(point, {
                center: getGlobeCenter(bounds),
                radius: getGlobeSize(bounds) / 2,
            })
        }

        if (
            !this.manager.isModalOpen &&
            !isElementInteractive(target) &&
            !isWithinGlobe
        ) {
            this.focusBracket = undefined
            this.persistFocusBracket = false
        }
    }

    @computed get mapConfig(): MapConfig {
        return this.manager.mapConfig || new MapConfig()
    }

    @action.bound onProjectionChange(value: MapProjectionName): void {
        this.mapConfig.projection = value
        void this.globeController.rotateToProjection(value)
    }

    @action.bound clearProjection(): void {
        this.mapConfig.projection = undefined
    }

    @action.bound onGlobeRotationChange(rotate: [number, number]): void {
        this.manager.globeRotation = rotate
    }

    @computed private get formatTooltipValue(): (d: PrimitiveType) => string {
        const { mapConfig, mapColumn, colorScale } = this

        return (d: PrimitiveType): string => {
            if (mapConfig.tooltipUseCustomLabels) {
                // Find the bin (and its label) that this value belongs to
                const bin = colorScale.getBinForValue(d)
                const label = bin?.label
                if (label !== undefined && label !== "") return label
            }
            return isNumber(d)
                ? mapColumn?.formatValueShort(d) ?? ""
                : anyToString(d)
        }
    }

    @computed get series(): ChoroplethSeries[] {
        const { mapColumn, selectionArray, targetTime } = this
        if (mapColumn.isMissing) return []
        if (targetTime === undefined) return []

        return mapColumn.owidRows
            .map((row) => {
                const { entityName, value, time } = row
                const color = this.colorScale.getColor(value) || "red" // todo: color fix
                if (!color) return undefined
                return {
                    seriesName: entityName,
                    time,
                    value,
                    isSelected: selectionArray.selectedSet.has(entityName),
                    color,
                    highlightFillColor: color,
                }
            })
            .filter(isPresent)
    }

    @computed private get seriesMap(): Map<SeriesName, ChoroplethSeries> {
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
                .selectAll(`.${CHOROPLETH_MAP_CLASSNAME} path`)
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
        if (this.manager.base?.current) {
            this.manager.base.current.addEventListener(
                "mousedown",
                this.onGrapherClick,
                { passive: true }
            )
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
        return this.bounds
            .padTop(this.isGlobe ? 4 : 0)
            .padBottom(this.legendHeight + 4)
    }

    @computed get projection(): MapProjectionName {
        return this.mapConfig.projection ?? MapProjectionName.World
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

        return flatten([bins[bins.length - 1], bins.slice(0, -1)])
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

    @computed get strokeWidth(): number | undefined {
        return this.manager.isStaticAndSmall ? 2 : undefined
    }

    renderMapLegend(): React.ReactElement {
        const { numericLegend, categoryLegend } = this

        return (
            <g>
                {numericLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                {categoryLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
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

        const { tooltipState } = this

        return (
            <g
                ref={this.base}
                className="mapTab"
                onMouseMove={this.onMapMouseMove}
            >
                <ChoroplethMap manager={this} />
                {this.renderMapLegend()}
                {tooltipState.target && (
                    <MapTooltip
                        tooltipState={tooltipState}
                        timeSeriesTable={this.inputTable}
                        formatValue={this.formatTooltipValue}
                        manager={this.manager}
                        colorScaleManager={this}
                        targetTime={this.targetTime}
                    />
                )}
            </g>
        )
    }
}

declare type SVGMouseEvent = React.MouseEvent<SVGElement>

@observer
class ChoroplethMap extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    // If true selected countries will have an outline
    @observable private showSelectedStyle = false

    private isDragging: boolean = false

    private previousScreenX: number | undefined = undefined
    private previousScreenY: number | undefined = undefined

    @computed private get uid(): number {
        return guid()
    }

    @computed private get manager(): ChoroplethMapManager {
        return this.props.manager
    }

    @computed private get strokeWidth(): number {
        return this.manager.strokeWidth ?? 1
    }

    @computed.struct private get bounds(): Bounds {
        return this.manager.choroplethMapBounds
    }

    @computed.struct private get choroplethData(): Map<
        string,
        ChoroplethSeries
    > {
        return this.manager.choroplethData
    }

    @computed.struct private get defaultFill(): string {
        return this.manager.noDataColor
    }

    // Combine bounding boxes to get the extents of the entire map
    @computed private get mapBounds(): Bounds {
        return Bounds.merge(geoBoundsFor(this.manager.projection))
    }

    @computed private get focusBracket(): ColorScaleBin | undefined {
        return this.manager.focusBracket
    }

    @computed private get focusEntity(): MapEntity | undefined {
        return this.manager.focusEntity
    }

    // Check if a geo entity is currently focused, either directly or via the bracket
    private hasFocus(id: string): boolean {
        const { choroplethData, focusBracket, focusEntity } = this
        if (focusEntity && focusEntity.id === id) return true
        else if (!focusBracket) return false

        const datum = choroplethData.get(id) || null
        if (focusBracket.contains(datum?.value)) return true
        else return false
    }

    private isSelected(id: string): boolean | undefined {
        return this.choroplethData.get(id)!.isSelected
    }

    @computed get isWorldProjection(): boolean {
        return this.manager.projection === MapProjectionName.World
    }

    @computed private get viewport(): Viewport {
        return VIEWPORTS[this.manager.projection]
    }

    // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
    @computed private get viewportScale(): number {
        const { bounds, viewport, mapBounds } = this
        if (this.manager.isGlobe) return 1
        const viewportWidth = viewport.width * mapBounds.width
        const viewportHeight = viewport.height * mapBounds.height
        return Math.min(
            bounds.width / viewportWidth,
            bounds.height / viewportHeight
        )
    }

    @computed private get globeSize(): number {
        return getGlobeSize(this.bounds)
    }

    @computed private get globeCenter(): [number, number] {
        const center = getGlobeCenter(this.bounds)
        return [center.x, center.y]
    }

    @computed private get globeScale(): number {
        const defaultScale = geoOrthographic().scale()
        const defaultSize = 500
        return defaultScale * (this.globeSize / defaultSize)
    }

    @computed private get globeRotation(): [number, number] {
        return this.manager.globeRotation
    }

    @computed private get globeProjection(): any {
        return geoOrthographic()
            .scale(this.globeScale)
            .translate(this.globeCenter)
            .rotate(this.globeRotation)
    }

    private globePathContext = new GeoPathRoundingContext()
    @computed private get globePath(): GeoPath<any, GeoPermissibleObjects> {
        return geoPath()
            .projection(this.globeProjection)
            .context(this.globePathContext)
    }

    private getPath(feature: RenderFeature): string {
        if (this.manager.isGlobe) {
            this.globePathContext.beginPath()
            this.globePath(feature.geo)
            return this.globePathContext.result()
        } else {
            return feature.path
        }
    }

    @computed private get globeEquator(): string {
        const equator = geoGraticule().step([0, 360])()
        this.globePathContext.beginPath()
        this.globePath(equator)
        return this.globePathContext.result()
    }

    @computed private get globeGraticule(): string {
        const graticule = geoGraticule().step([10, 10])()
        this.globePathContext.beginPath()
        this.globePath(graticule)
        return this.globePathContext.result()
    }

    @computed private get matrixTransform(): string | undefined {
        const { bounds, mapBounds, viewport, viewportScale } = this

        if (this.manager.isGlobe) return undefined

        // Calculate our reference dimensions. These values are independent of the current
        // map translation and scaling.
        const mapX = mapBounds.x + 1
        const mapY = mapBounds.y + 1

        // Work out how to center the map, accounting for the new scaling we've worked out
        const newWidth = mapBounds.width * viewportScale
        const newHeight = mapBounds.height * viewportScale
        const boundsCenterX = bounds.left + bounds.width / 2
        const boundsCenterY = bounds.top + bounds.height / 2
        const newCenterX =
            mapX + (viewportScale - 1) * mapBounds.x + viewport.x * newWidth
        const newCenterY =
            mapY + (viewportScale - 1) * mapBounds.y + viewport.y * newHeight
        const newOffsetX = boundsCenterX - newCenterX
        const newOffsetY = boundsCenterY - newCenterY

        const matrixStr = `matrix(${viewportScale},0,0,${viewportScale},${newOffsetX},${newOffsetY})`
        return matrixStr
    }

    // Features that aren't part of the current projection (e.g. India if we're showing Africa)
    @computed private get featuresOutsideProjection(): RenderFeature[] {
        return difference(
            renderFeaturesFor(this.manager.projection),
            this.featuresInProjection
        )
    }

    @computed private get featuresInProjection(): RenderFeature[] {
        const { projection } = this.manager
        const features = renderFeaturesFor(projection)
        if (this.manager.isGlobe || this.isWorldProjection) return features

        return features.filter(
            (feature) =>
                projection ===
                (WorldRegionToProjection[
                    feature.id as WorldRegionName
                ] as any as MapProjectionName)
        )
    }

    @computed private get featuresWithNoData(): RenderFeature[] {
        return difference(this.featuresInProjection, this.featuresWithData)
    }

    @computed private get featuresWithData(): RenderFeature[] {
        return this.featuresInProjection.filter((feature) =>
            this.choroplethData.has(feature.id)
        )
    }

    // Map uses a hybrid approach to mouseover
    // If mouse is inside an element, that is prioritized
    // Otherwise we do a quadtree search for the closest center point of a feature bounds,
    // so that we can hover very small countries without trouble

    @computed private get quadtree(): Quadtree<RenderFeature> {
        return quadtree<RenderFeature>()
            .x(({ center, geoCentroid }) => {
                const globeCenter = this.globeProjection([
                    geoCentroid.x,
                    geoCentroid.y,
                ])
                return this.manager.isGlobe ? globeCenter[0] : center.x
            })
            .y(({ center, geoCentroid }) => {
                const globeCenter = this.globeProjection([
                    geoCentroid.x,
                    geoCentroid.y,
                ])
                return this.manager.isGlobe ? globeCenter[1] : center.y
            })
            .addAll(this.featuresInProjection)
    }

    @action.bound private startDragging(): void {
        this.isDragging = true
        this.manager.clearProjection()
        document.body.style.cursor = "pointer"
    }

    private stopDragTimerId: NodeJS.Timeout | undefined
    @action.bound private stopDragging(): void {
        if (this.stopDragTimerId) clearTimeout(this.stopDragTimerId)
        // stop dragging after a short delay to silence click events
        this.stopDragTimerId = setTimeout(() => {
            this.isDragging = false
            this.previousScreenX = undefined
            this.previousScreenY = undefined
        }, 100)
        document.body.style.cursor = "default"
    }

    private rotateFrameId: number | undefined
    @action.bound private rotateGlobe(
        startCoords: [number, number],
        endCoords: [number, number]
    ): void {
        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
        this.rotateFrameId = requestAnimationFrame(() => {
            const dx = endCoords[0] - startCoords[0]
            const dy = endCoords[1] - startCoords[1]

            const sensitivity = 0.7
            const [rx, ry] = this.globeProjection.rotate()
            this.manager.onGlobeRotationChange([
                rx + dx * sensitivity,
                clamp(ry - dy * sensitivity, -90, 90),
            ])
        })
    }

    @action.bound private onCursorDrag(event: MouseEvent | TouchEvent): void {
        if (!this.manager.isGlobe) return

        const { screenX, screenY } = getScreenCoords(event)

        // start dragging if this is the first move event
        if (
            this.previousScreenX === undefined ||
            this.previousScreenY === undefined
        ) {
            this.startDragging()

            // init screen coords
            this.previousScreenX = screenX
            this.previousScreenY = screenY
        }

        // dismiss the currently hovered feature
        if (this.hoverEnterFeature || this.hoverNearbyFeature) {
            this.hoverEnterFeature = undefined
            this.hoverNearbyFeature = undefined
            this.manager.onMapMouseLeave()
        }

        // rotate globe from the previous screen coords to the current screen coords
        this.rotateGlobe(
            [this.previousScreenX, this.previousScreenY],
            [screenX, screenY]
        )

        // update screen coords
        this.previousScreenX = screenX
        this.previousScreenY = screenY
    }

    @observable private hoverEnterFeature?: RenderFeature
    @observable private hoverNearbyFeature?: RenderFeature
    @action.bound private detectNearbyFeature(
        event: MouseEvent | TouchEvent
    ): void {
        if (this.isDragging || this.hoverEnterFeature) return
        const subunits = this.base.current?.querySelector(".subunits")
        if (subunits) {
            const { x, y } = getRelativeMouse(subunits, event)
            const distance = MAP_HOVER_TARGET_RANGE
            const feature = this.quadtree.find(x, y, distance)
            if (feature) {
                if (feature.id !== this.hoverNearbyFeature?.id) {
                    this.hoverNearbyFeature = feature
                    this.manager.onMapMouseOver(feature.geo)
                }
            } else if (this.hoverNearbyFeature) {
                this.hoverNearbyFeature = undefined
                this.manager.onMapMouseLeave()
            }
        } else console.error("subunits was falsy")
    }

    @action.bound private onMouseDown(event: MouseEvent): void {
        if (this.manager.isGlobe) {
            event.preventDefault() // prevent text selection

            // register mousemove and mouseup events on the document
            // so that dragging continues if the mouse leaves the map
            document.addEventListener("mousemove", this.onCursorDrag, {
                passive: true,
            })
            document.addEventListener("mouseup", this.onMouseUp, {
                passive: true,
            })
        }
    }

    @action.bound private onMouseUp(): void {
        this.stopDragging()

        document.removeEventListener("mousemove", this.onCursorDrag)
        document.removeEventListener("mouseup", this.onMouseUp)
    }

    @action.bound private onMouseMove(event: MouseEvent): void {
        if (event.shiftKey) this.showSelectedStyle = true // Turn on highlight selection. To turn off, user can switch tabs.
        this.detectNearbyFeature(event)
    }

    @action.bound private onTouchStart(event: TouchEvent): void {
        this.detectNearbyFeature(event)

        if (this.base.current) {
            this.base.current.addEventListener("touchmove", this.onTouchMove, {
                passive: false,
            })
            this.base.current.addEventListener("touchend", this.onTouchEnd, {
                passive: true,
            })
            this.base.current.addEventListener("touchcancel", this.onTouchEnd, {
                passive: true,
            })
        }
    }

    @action.bound private onTouchMove(event: TouchEvent): void {
        event.preventDefault() // prevent scrolling
        this.onCursorDrag(event)
    }

    @action.bound private onTouchEnd(): void {
        this.stopDragging()

        if (this.base.current) {
            this.base.current.removeEventListener("touchmove", this.onTouchMove)
            this.base.current.removeEventListener("touchend", this.onTouchEnd)
            this.base.current.removeEventListener(
                "touchcancel",
                this.onTouchEnd
            )
        }
    }

    @action.bound private onMouseEnterFeature(feature: RenderFeature): void {
        // don't show tooltips when dragging
        if (this.isDragging) return

        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver(feature.geo)
    }

    @action.bound private onMouseLeaveFeature(): void {
        this.hoverEnterFeature = undefined
        this.manager.onMapMouseLeave()
    }

    @computed private get hoverFeature(): RenderFeature | undefined {
        return this.hoverEnterFeature || this.hoverNearbyFeature
    }

    @computed private get isRotatedToLocalFeature(): boolean {
        if (!this.localFeature) return false
        return (
            -this.localFeature.geoCentroid.x === this.globeRotation[0] &&
            -this.localFeature.geoCentroid.y === this.globeRotation[1]
        )
    }

    @computed private get isRotatedToDefault(): boolean {
        return Object.values(DEFAULT_ROTATIONS).some(
            ([defaultX, defaultY]) =>
                defaultX === this.globeRotation[0] &&
                defaultY === this.globeRotation[1]
        )
    }

    @observable private localFeature?: RenderFeature
    private async populateLocalEntityName(): Promise<void> {
        if (this.localFeature) return
        try {
            const localCountryInfo = await getUserCountryInformation()
            if (localCountryInfo) {
                const localFeature = this.featuresInProjection.find(
                    (f) => f.id === localCountryInfo.name
                )
                if (localFeature) this.localFeature = localFeature
            }
        } catch (err) {}
    }

    async componentDidMount(): Promise<void> {
        if (this.base.current) {
            this.base.current.addEventListener("mousedown", this.onMouseDown, {
                passive: false,
            })
            this.base.current.addEventListener("mousemove", this.onMouseMove, {
                passive: true,
            })
            this.base.current.addEventListener(
                "touchstart",
                this.onTouchStart,
                { passive: true }
            )
        }

        if (
            this.globeRotation[0] !== DEFAULT_VIEWPORT.rotation[0] ||
            this.globeRotation[1] !== DEFAULT_VIEWPORT.rotation[1]
        )
            return

        if (!this.isWorldProjection) {
            this.manager.onGlobeRotationChange(this.viewport.rotation)
        } else {
            await this.populateLocalEntityName()
            if (this.localFeature) {
                const { geoCentroid } = this.localFeature
                void this.manager.globeController.rotateTo([
                    -geoCentroid.x,
                    -geoCentroid.y,
                ])
            } else {
                // if the user's country can't be detected,
                // choose a default rotation based on the time of day
                const date = new Date()
                const hours = date.getUTCHours()
                const minutes = date.getUTCMinutes()
                let defaultRotation: [number, number]
                if (hours <= 7 && minutes <= 59) {
                    defaultRotation = DEFAULT_ROTATIONS.UTC_MORNING
                } else if (hours <= 15 && minutes <= 59) {
                    defaultRotation = DEFAULT_ROTATIONS.UTC_MIDDAY
                } else {
                    defaultRotation = DEFAULT_ROTATIONS.UTC_EVENING
                }
                void this.manager.globeController.rotateTo(defaultRotation)
            }
        }
    }

    componentWillUnmount(): void {
        if (this.base.current) {
            this.base.current.removeEventListener("mousedown", this.onMouseDown)
            this.base.current.removeEventListener("mousemove", this.onMouseMove)
            this.base.current.removeEventListener(
                "touchstart",
                this.onTouchStart
            )
        }

        if (this.stopDragTimerId) clearTimeout(this.stopDragTimerId)
        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
    }

    // SVG layering is based on order of appearance in the element tree (later elements rendered on top)
    // The ordering here is quite careful
    render(): React.ReactElement {
        const {
            uid,
            bounds,
            choroplethData,
            defaultFill,
            matrixTransform,
            viewportScale,
            featuresOutsideProjection,
            featuresWithNoData,
            featuresWithData,
        } = this
        const focusStrokeColor = "#111"
        const defaultStrokeWidth = this.strokeWidth * 0.3
        const focusStrokeWidth = this.strokeWidth * 1.5
        const selectedStrokeWidth = this.strokeWidth * 1
        const patternStrokeWidth = this.strokeWidth * 0.7
        const blurFillOpacity = 0.2
        const blurStrokeOpacity = 0.5

        const clipPath = makeClipPath(uid, bounds)

        // this needs to be referenced here or it will be recomputed on every mousemove
        const _cachedCentroids = this.quadtree

        return (
            <g
                ref={this.base}
                className={CHOROPLETH_MAP_CLASSNAME}
                clipPath={clipPath.id}
                style={{
                    touchAction: this.manager.isGlobe
                        ? "pinch-zoom"
                        : undefined,
                }}
            >
                {this.manager.isGlobe ? (
                    <circle
                        className="globe-sphere"
                        cx={this.globeCenter[0]}
                        cy={this.globeCenter[1]}
                        r={this.globeSize / 2}
                        fill="#fafafa"
                    />
                ) : (
                    <rect
                        x={bounds.x}
                        y={bounds.y}
                        width={bounds.width}
                        height={bounds.height}
                        fill="rgba(255,255,255,0)"
                        opacity={0}
                    />
                )}
                {this.manager.isGlobe && (
                    <>
                        <path
                            className="globe-graticule"
                            d={this.globeGraticule}
                            stroke="#d2d2d2"
                            strokeWidth={defaultStrokeWidth}
                            fill="none"
                            style={{ pointerEvents: "none" }}
                        />
                        <path
                            className="globe-equator"
                            d={this.globeEquator}
                            stroke="#dadada"
                            strokeWidth={defaultStrokeWidth}
                            fill="none"
                            style={{ pointerEvents: "none" }}
                        />
                    </>
                )}
                {this.manager.isGlobe &&
                    (this.isRotatedToLocalFeature ||
                        this.isRotatedToDefault) && (
                        <GlobeLocationInfo
                            bounds={this.bounds}
                            label={
                                this.localFeature
                                    ? "Rotated to your current location"
                                    : "Rotated to a default view chosen based on the time of day"
                            }
                            fontSize={
                                GRAPHER_FONT_SCALE_9_6 *
                                (this.manager.fontSize ?? 16)
                            }
                        />
                    )}
                {clipPath.element}
                <g className="subunits" transform={matrixTransform}>
                    {featuresOutsideProjection.length > 0 && (
                        <g className="nonProjectionFeatures">
                            {featuresOutsideProjection.map((feature) => {
                                return (
                                    <path
                                        key={feature.id}
                                        d={this.getPath(feature)}
                                        strokeWidth={
                                            defaultStrokeWidth / viewportScale
                                        }
                                        stroke={"#aaa"}
                                        fill={"#fff"}
                                    />
                                )
                            })}
                        </g>
                    )}

                    {featuresWithNoData.length > 0 && (
                        <g className="noDataFeatures">
                            <defs>
                                <pattern
                                    // Ids should be unique per document (!) not just a grapher instance -
                                    // we disregard this for other patterns that are defined the same everywhere
                                    // because id collisions there are benign but here the pattern will be different
                                    // depending on the projection so we include this in the id
                                    id={`${Patterns.noDataPatternForMapChart}-${this.manager.projection}`}
                                    key={Patterns.noDataPatternForMapChart}
                                    patternUnits="userSpaceOnUse"
                                    width="4"
                                    height="4"
                                    patternTransform={`rotate(-45 2 2) scale(${
                                        1 / this.viewportScale
                                    })`} // <-- This scale here is crucial and map specific
                                >
                                    <rect width="4" height="4" fill="#fff" />
                                    <path
                                        d="M -1,2 l 6,0"
                                        stroke="#ccc"
                                        strokeWidth={patternStrokeWidth}
                                    />
                                </pattern>
                            </defs>

                            {featuresWithNoData.map((feature) => {
                                const isFocus = this.hasFocus(feature.id)
                                const outOfFocusBracket =
                                    !!this.focusBracket && !isFocus
                                const stroke = isFocus
                                    ? focusStrokeColor
                                    : "#aaa"
                                const fillOpacity = outOfFocusBracket
                                    ? blurFillOpacity
                                    : 1
                                const strokeOpacity = outOfFocusBracket
                                    ? blurStrokeOpacity
                                    : 1
                                return (
                                    <path
                                        key={feature.id}
                                        d={this.getPath(feature)}
                                        strokeWidth={
                                            (isFocus
                                                ? focusStrokeWidth
                                                : defaultStrokeWidth) /
                                            viewportScale
                                        }
                                        stroke={stroke}
                                        strokeOpacity={strokeOpacity}
                                        cursor="pointer"
                                        fill={`url(#${Patterns.noDataPatternForMapChart}-${this.manager.projection})`}
                                        fillOpacity={fillOpacity}
                                        onClick={(ev: SVGMouseEvent): void => {
                                            if (this.isDragging) return
                                            this.manager.onClickFeature(
                                                feature.geo,
                                                ev
                                            )
                                        }}
                                        onMouseEnter={(): void =>
                                            this.onMouseEnterFeature(feature)
                                        }
                                        onMouseLeave={this.onMouseLeaveFeature}
                                    />
                                )
                            })}
                        </g>
                    )}

                    {sortBy(
                        featuresWithData.map((feature) => {
                            const isFocus = this.hasFocus(feature.id)
                            const showSelectedStyle =
                                this.showSelectedStyle &&
                                this.isSelected(feature.id)
                            const outOfFocusBracket =
                                !!this.focusBracket && !isFocus
                            const series = choroplethData.get(
                                feature.id as string
                            )
                            const stroke =
                                isFocus || showSelectedStyle
                                    ? focusStrokeColor
                                    : DEFAULT_STROKE_COLOR
                            const fill = series ? series.color : defaultFill
                            const fillOpacity = outOfFocusBracket
                                ? blurFillOpacity
                                : 1
                            const strokeOpacity = outOfFocusBracket
                                ? blurStrokeOpacity
                                : 1

                            return (
                                <path
                                    key={feature.id}
                                    d={this.getPath(feature)}
                                    strokeWidth={
                                        (isFocus
                                            ? focusStrokeWidth
                                            : showSelectedStyle
                                              ? selectedStrokeWidth
                                              : defaultStrokeWidth) /
                                        viewportScale
                                    }
                                    stroke={stroke}
                                    strokeOpacity={strokeOpacity}
                                    cursor="pointer"
                                    fill={fill}
                                    fillOpacity={fillOpacity}
                                    onClick={(ev: SVGMouseEvent): void => {
                                        if (this.isDragging) return
                                        this.manager.onClickFeature(
                                            feature.geo,
                                            ev
                                        )
                                    }}
                                    onMouseEnter={(): void =>
                                        this.onMouseEnterFeature(feature)
                                    }
                                    onMouseLeave={this.onMouseLeaveFeature}
                                />
                            )
                        }),
                        (p) => p.props["strokeWidth"]
                    )}
                </g>
            </g>
        )
    }
}

const getScreenCoords = (
    event: MouseEvent | TouchEvent
): { screenX: number; screenY: number } => {
    return isTouchEvent(event)
        ? event.touches[0]
        : {
              screenX: event.screenX,
              screenY: event.screenY,
          }
}

const isTouchEvent = (event: MouseEvent | TouchEvent): event is TouchEvent => {
    return event.type.includes("touch")
}

const getGlobeSize = (bounds: Bounds): number => {
    return Math.min(bounds.width, bounds.height)
}

const getGlobeCenter = (bounds: Bounds): PointVector => {
    return new PointVector(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2
    )
}

function GlobeLocationInfo({
    bounds,
    label,
    fontSize,
}: {
    bounds: Bounds
    label: string
    fontSize?: number
}): React.ReactElement {
    return (
        <foreignObject
            x={bounds.x}
            y={bounds.y}
            width={bounds.width}
            height={bounds.height}
            style={{
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    fontSize: fontSize ?? 9,
                    fontStyle: "italic",
                    width: "25%",
                    lineHeight: 1,
                    color: "#858585",
                    textAlign: "right",
                }}
            >
                <FontAwesomeIcon
                    icon={faLocationArrow}
                    style={{
                        marginRight: 6,
                        fontSize: "0.8em",
                        position: "relative",
                        bottom: "0.5px",
                    }}
                />
                {label}
            </div>
        </foreignObject>
    )
}
