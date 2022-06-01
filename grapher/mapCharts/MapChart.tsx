import React from "react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends.js"
import {
    flatten,
    getRelativeMouse,
    isString,
    identity,
    sortBy,
    guid,
    minBy,
    difference,
    exposeInstanceOnWindow,
} from "../../clientUtils/Util.js"
import { isPresent } from "../../clientUtils/isPresent.js"
import { MapProjectionName, MapProjectionGeos } from "./MapProjections.js"
import { select } from "d3-selection"
import { easeCubic } from "d3-ease"
import { MapTooltip } from "./MapTooltip.js"
import { ProjectionChooser } from "./ProjectionChooser.js"
import { isOnTheMap } from "./EntitiesOnTheMap.js"
import { EntityName } from "../../coreTable/OwidTableConstants.js"
import {
    GeoFeature,
    MapBracket,
    MapChartManager,
    MapEntity,
    ChoroplethMapProps,
    RenderFeature,
    ChoroplethSeries,
} from "./MapChartConstants.js"
import { MapConfig } from "./MapConfig.js"
import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import {
    BASE_FONT_SIZE,
    GrapherTabOption,
    SeriesName,
} from "../core/GrapherConstants.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "../color/ColorScaleBin.js"
import * as topojson from "topojson-client"
import { MapTopology } from "./MapTopology.js"
import { PointVector } from "../../clientUtils/PointVector.js"
import {
    WorldRegionName,
    WorldRegionToProjection,
} from "./WorldRegionsToProjection.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import {
    autoDetectYColumnSlugs,
    makeClipPath,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { ColorScaleConfig } from "../color/ColorScaleConfig.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import {
    Color,
    HorizontalAlign,
    PrimitiveType,
} from "../../clientUtils/owidTypes.js"

const PROJECTION_CHOOSER_WIDTH = 110
const PROJECTION_CHOOSER_HEIGHT = 22

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
    const projectionGeo = MapProjectionGeos[projectionName]
    const strs = GeoFeatures.map((feature) => {
        const s = projectionGeo(feature) as string
        const paths = s.split(/Z/).filter(identity)

        const newPaths = paths.map((path) => {
            const points = path.split(/[MLZ]/).filter((f: any) => f)
            const rounded = points.map((point) =>
                point
                    .split(/,/)
                    .map((v) => parseFloat(v).toFixed(1))
                    .join(",")
            )
            return "M" + rounded.join("L")
        })

        return newPaths.join("Z") + "Z"
    })

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

// Bundle GeoFeatures with the calculated info needed to render them
const renderFeaturesCache = new Map<MapProjectionName, RenderFeature[]>()
const renderFeaturesFor = (
    projectionName: MapProjectionName
): RenderFeature[] => {
    if (renderFeaturesCache.has(projectionName))
        return renderFeaturesCache.get(projectionName)!
    const geoBounds = geoBoundsFor(projectionName)
    const geoPaths = geoPathsFor(projectionName)
    const feats = GeoFeatures.map((geo, index) => ({
        id: geo.id as string,
        geo: geo,
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
    @observable.ref tooltip: React.ReactNode | null = null
    @observable tooltipTarget?: { x: number; y: number; featureId: string }

    @observable focusEntity?: MapEntity
    @observable focusBracket?: MapBracket

    transformTable(table: OwidTable): OwidTable {
        if (!table.has(this.mapColumnSlug)) return table
        return this.dropNonMapEntities(table)
            .dropRowsWithErrorValuesForColumn(this.mapColumnSlug)
            .interpolateColumnWithTolerance(
                this.mapColumnSlug,
                this.mapConfig.timeTolerance
            )
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

    base: React.RefObject<SVGGElement> = React.createRef()
    @action.bound onMapMouseOver(
        feature: GeoFeature,
        ev: React.MouseEvent
    ): void {
        const series =
            feature.id === undefined
                ? undefined
                : this.seriesMap.get(feature.id as string)
        this.focusEntity = {
            id: feature.id,
            series: series || { value: "No data" },
        }

        const { containerElement } = this.props
        if (!containerElement) return

        const mouse = getRelativeMouse(containerElement, ev)
        if (feature.id !== undefined)
            this.tooltipTarget = {
                x: mouse.x,
                y: mouse.y,
                featureId: feature.id as string,
            }
    }

    @action.bound onMapMouseLeave(): void {
        this.focusEntity = undefined
        this.tooltipTarget = undefined
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
        return makeSelectionArray(this.manager)
    }

    @action.bound onClick(
        d: GeoFeature,
        ev: React.MouseEvent<SVGElement>
    ): void {
        const entityName = d.id as EntityName
        if (!this.isEntityClickable(entityName)) return

        if (!ev.shiftKey) {
            this.selectionArray.setSelectedEntities([entityName])
            this.manager.currentTab = GrapherTabOption.chart
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

    @action.bound onProjectionChange(value: MapProjectionName): void {
        this.mapConfig.projection = value
    }

    @computed private get formatTooltipValue(): (d: number | string) => string {
        const { mapConfig, mapColumn, colorScale } = this

        return (d: PrimitiveType): string => {
            if (mapConfig.tooltipUseCustomLabels) {
                // Find the bin (and its label) that this value belongs to
                const bin = colorScale.getBinForValue(d)
                const label = bin?.label
                if (label !== undefined && label !== "") return label
            }
            return mapColumn?.formatValueLong(d) ?? ""
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
        exposeInstanceOnWindow(this)
    }

    @computed get projectionChooserBounds(): Bounds {
        const { bounds } = this
        return new Bounds(
            bounds.width - PROJECTION_CHOOSER_WIDTH + 15 - 3,
            5,
            PROJECTION_CHOOSER_WIDTH,
            PROJECTION_CHOOSER_HEIGHT
        )
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
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
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

        const bin = this.legendData.filter(
            (bin) =>
                (bin instanceof NumericBin || bin.value === "No data") &&
                !bin.isHidden
        )
        return flatten([bin[bin.length - 1], bin.slice(0, -1)])
    }

    @computed get hasNumeric(): boolean {
        return this.numericLegendData.length > 1
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.legendData.filter(
            (bin): bin is CategoricalBin =>
                bin instanceof CategoricalBin && !bin.isHidden
        )
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

    @computed get legendWidth(): number {
        return this.bounds.width * 0.8
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

    @computed get legendX(): number {
        return this.bounds.centerX - this.legendWidth / 2
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

    renderMapLegend(): JSX.Element {
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

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const {
            focusBracket,
            focusEntity,
            tooltipTarget,
            projectionChooserBounds,
            seriesMap,
            colorScale,
            mapConfig,
        } = this

        const { projection } = mapConfig

        return (
            <g ref={this.base} className="mapTab">
                <ChoroplethMap
                    bounds={this.bounds.padBottom(this.legendHeight + 15)}
                    choroplethData={seriesMap}
                    projection={projection}
                    defaultFill={colorScale.noDataColor}
                    onHover={this.onMapMouseOver}
                    onHoverStop={this.onMapMouseLeave}
                    onClick={this.onClick}
                    focusBracket={focusBracket}
                    focusEntity={focusEntity}
                />
                {this.renderMapLegend()}
                <foreignObject
                    id="projection-chooser"
                    x={projectionChooserBounds.left}
                    y={projectionChooserBounds.top}
                    width={projectionChooserBounds.width}
                    height={projectionChooserBounds.height}
                    style={{
                        overflow: "visible",
                        height: "100%",
                        pointerEvents: "none",
                    }}
                >
                    <ProjectionChooser
                        value={projection}
                        onChange={this.onProjectionChange}
                    />
                </foreignObject>
                {tooltipTarget && (
                    <MapTooltip
                        entityName={tooltipTarget?.featureId}
                        timeSeriesTable={this.inputTable}
                        formatValue={this.formatTooltipValue}
                        isEntityClickable={this.isEntityClickable(
                            tooltipTarget?.featureId
                        )}
                        tooltipTarget={tooltipTarget}
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
class ChoroplethMap extends React.Component<ChoroplethMapProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get uid(): number {
        return guid()
    }

    @computed.struct private get bounds(): Bounds {
        return this.props.bounds
    }

    @computed.struct private get choroplethData(): Map<
        string,
        ChoroplethSeries
    > {
        return this.props.choroplethData
    }

    @computed.struct private get defaultFill(): string {
        return this.props.defaultFill
    }

    // Combine bounding boxes to get the extents of the entire map
    @computed private get mapBounds(): Bounds {
        return Bounds.merge(geoBoundsFor(this.props.projection))
    }

    @computed private get focusBracket(): ColorScaleBin | undefined {
        return this.props.focusBracket
    }

    @computed private get focusEntity(): MapEntity | undefined {
        return this.props.focusEntity
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

    // Viewport for each projection, defined by center and width+height in fractional coordinates
    @computed private get viewport(): {
        x: number
        y: number
        width: number
        height: number
    } {
        const viewports = {
            World: { x: 0.565, y: 0.5, width: 1, height: 1 },
            Europe: { x: 0.5, y: 0.22, width: 0.2, height: 0.2 },
            Africa: { x: 0.49, y: 0.7, width: 0.21, height: 0.38 },
            NorthAmerica: { x: 0.49, y: 0.4, width: 0.19, height: 0.32 },
            SouthAmerica: { x: 0.52, y: 0.815, width: 0.1, height: 0.26 },
            Asia: { x: 0.75, y: 0.45, width: 0.3, height: 0.5 },
            Oceania: { x: 0.51, y: 0.75, width: 0.1, height: 0.2 },
        }

        return viewports[this.props.projection]
    }

    // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
    @computed private get viewportScale(): number {
        const { bounds, viewport, mapBounds } = this
        const viewportWidth = viewport.width * mapBounds.width
        const viewportHeight = viewport.height * mapBounds.height
        return Math.min(
            bounds.width / viewportWidth,
            bounds.height / viewportHeight
        )
    }

    @computed private get matrixTransform(): string {
        const { bounds, mapBounds, viewport, viewportScale } = this

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
            renderFeaturesFor(this.props.projection),
            this.featuresInProjection
        )
    }

    @computed private get featuresInProjection(): RenderFeature[] {
        const { projection } = this.props
        const features = renderFeaturesFor(this.props.projection)
        if (projection === MapProjectionName.World) return features

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
    // Otherwise we look for the closest center point of a feature bounds, so that we can hover
    // very small countries without trouble

    @observable private hoverEnterFeature?: RenderFeature
    @observable private hoverNearbyFeature?: RenderFeature
    @action.bound private onMouseMove(ev: React.MouseEvent<SVGGElement>): void {
        if (ev.shiftKey) this.showSelectedStyle = true // Turn on highlight selection. To turn off, user can switch tabs.
        if (this.hoverEnterFeature) return

        const { featuresInProjection } = this
        const subunits = this.base.current?.querySelector(".subunits")
        if (subunits) {
            const mouse = getRelativeMouse(subunits, ev)

            const featuresWithDistance = featuresInProjection.map((feature) => {
                return {
                    feature,
                    distance: PointVector.distance(feature.center, mouse),
                }
            })

            const feature = minBy(featuresWithDistance, (d) => d.distance)

            if (feature && feature.distance < 20) {
                if (feature.feature !== this.hoverNearbyFeature) {
                    this.hoverNearbyFeature = feature.feature
                    this.props.onHover(feature.feature.geo, ev)
                }
            } else {
                this.hoverNearbyFeature = undefined
                this.props.onHoverStop()
            }
        } else console.error("subunits was falsy")
    }

    @action.bound private onMouseEnter(
        feature: RenderFeature,
        ev: SVGMouseEvent
    ): void {
        this.hoverEnterFeature = feature
        this.props.onHover(feature.geo, ev)
    }

    @action.bound private onMouseLeave(): void {
        this.hoverEnterFeature = undefined
        this.props.onHoverStop()
    }

    @computed private get hoverFeature(): RenderFeature | undefined {
        return this.hoverEnterFeature || this.hoverNearbyFeature
    }

    @action.bound private onClick(ev: React.MouseEvent<SVGGElement>): void {
        if (this.hoverFeature !== undefined)
            this.props.onClick(this.hoverFeature.geo, ev)
    }

    // If true selected countries will have an outline
    @observable private showSelectedStyle = false

    // SVG layering is based on order of appearance in the element tree (later elements rendered on top)
    // The ordering here is quite careful
    render(): JSX.Element {
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
        const focusStrokeWidth = 1.5
        const selectedStrokeWidth = 1
        const blurFillOpacity = 0.2
        const blurStrokeOpacity = 0.5

        const clipPath = makeClipPath(uid, bounds)

        return (
            <g
                ref={this.base}
                className={CHOROPLETH_MAP_CLASSNAME}
                clipPath={clipPath.id}
                onMouseDown={
                    (ev: SVGMouseEvent): void =>
                        ev.preventDefault() /* Without this, title may get selected while shift clicking */
                }
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                style={this.hoverFeature ? { cursor: "pointer" } : {}}
            >
                <rect
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {clipPath.element}
                <g className="subunits" transform={matrixTransform}>
                    {featuresOutsideProjection.length && (
                        <g className="nonProjectionFeatures">
                            {featuresOutsideProjection.map((feature) => {
                                return (
                                    <path
                                        key={feature.id}
                                        d={feature.path}
                                        strokeWidth={0.3 / viewportScale}
                                        stroke={"#aaa"}
                                        fill={"#fff"}
                                    />
                                )
                            })}
                        </g>
                    )}

                    {featuresWithNoData.length && (
                        <g className="noDataFeatures">
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
                                        d={feature.path}
                                        strokeWidth={
                                            (isFocus ? focusStrokeWidth : 0.3) /
                                            viewportScale
                                        }
                                        stroke={stroke}
                                        strokeOpacity={strokeOpacity}
                                        cursor="pointer"
                                        fill={defaultFill}
                                        fillOpacity={fillOpacity}
                                        onClick={(ev: SVGMouseEvent): void =>
                                            this.props.onClick(feature.geo, ev)
                                        }
                                        onMouseEnter={(ev): void =>
                                            this.onMouseEnter(feature, ev)
                                        }
                                        onMouseLeave={this.onMouseLeave}
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
                                    d={feature.path}
                                    strokeWidth={
                                        (isFocus
                                            ? focusStrokeWidth
                                            : showSelectedStyle
                                            ? selectedStrokeWidth
                                            : 0.3) / viewportScale
                                    }
                                    stroke={stroke}
                                    strokeOpacity={strokeOpacity}
                                    cursor="pointer"
                                    fill={fill}
                                    fillOpacity={fillOpacity}
                                    onClick={(ev: SVGMouseEvent): void =>
                                        this.props.onClick(feature.geo, ev)
                                    }
                                    onMouseEnter={(ev): void =>
                                        this.onMouseEnter(feature, ev)
                                    }
                                    onMouseLeave={this.onMouseLeave}
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
