import React from "react"
import {
    Bounds,
    difference,
    InteractionState,
    isTouchDevice,
    makeIdForHumanConsumption,
    MapRegionName,
    sortBy,
} from "@ourworldindata/utils"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { Quadtree, quadtree } from "d3-quadtree"
import {
    MapRenderFeature,
    MAP_VIEWPORTS,
    MapViewport,
    SVGMouseEvent,
    GEO_FEATURES_CLASSNAME,
    ChoroplethMapManager,
    ChoroplethSeriesByName,
    DEFAULT_STROKE_WIDTH,
    CHOROPLETH_MAP_CLASSNAME,
} from "./MapChartConstants"
import {
    geoBoundsForProjectionOf,
    renderFeaturesForProjectionOf,
} from "./GeoFeatures"
import { getCountriesByRegion } from "./WorldRegionsToProjection"
import {
    CountryOutsideOfSelectedRegion,
    CountryWithData,
    CountryWithNoData,
    NoDataPattern,
} from "./MapComponents"
import { MapConfig } from "./MapConfig"
import { Patterns } from "../core/GrapherConstants"
import { detectNearbyFeature, hasFocus } from "./MapHelpers"

@observer
export class ChoroplethMap extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    /** Show an outline for selected countries */
    @observable private showSelectedStyle = false

    @observable private hoverEnterFeature?: MapRenderFeature
    @observable private hoverNearbyFeature?: MapRenderFeature

    @computed private get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    @computed private get manager(): ChoroplethMapManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig
    }

    @computed private get region(): MapRegionName {
        return this.mapConfig.region
    }

    @computed.struct private get bounds(): Bounds {
        return this.manager.choroplethMapBounds
    }

    @computed.struct private get choroplethData(): ChoroplethSeriesByName {
        return this.manager.choroplethData
    }

    @computed private get hoverFeature(): MapRenderFeature | undefined {
        return this.hoverEnterFeature || this.hoverNearbyFeature
    }

    // Combine bounding boxes to get the extents of the entire map
    @computed private get mapBounds(): Bounds {
        return Bounds.merge(geoBoundsForProjectionOf(this.region))
    }

    @computed private get viewport(): MapViewport {
        return MAP_VIEWPORTS[this.region]
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

    @computed private get viewportScaleSqrt(): number {
        return Math.sqrt(this.viewportScale)
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

    @computed private get featuresInRegion(): MapRenderFeature[] {
        const { region } = this
        const features = renderFeaturesForProjectionOf(region)
        if (region === MapRegionName.World) return features

        const countriesByRegion = getCountriesByRegion(region)
        if (countriesByRegion === undefined) return []

        return features.filter((feature) => countriesByRegion.has(feature.id))
    }

    /** Features that aren't part of the current region (e.g. India if we're showing Africa) */
    @computed
    private get featuresOutsideOfSelectedRegion(): MapRenderFeature[] {
        return difference(
            renderFeaturesForProjectionOf(this.region),
            this.featuresInRegion
        )
    }

    @computed private get featuresWithData(): MapRenderFeature[] {
        const features = this.featuresInRegion.filter((feature) =>
            this.choroplethData.has(feature.id)
        )

        // sort features so that focused features are rendered last
        return sortBy(features, (feature) => {
            const isFocused = this.hasFocus(feature.id)
            if (isFocused) return 2
            const series = this.choroplethData.get(feature.id)
            if (series?.isSelected) return 1
            return 0
        })
    }

    @computed private get featuresWithNoData(): MapRenderFeature[] {
        return difference(this.featuresInRegion, this.featuresWithData)
    }

    @computed private get quadtree(): Quadtree<MapRenderFeature> {
        return quadtree<MapRenderFeature>()
            .x((feature) => feature.center.x)
            .y((feature) => feature.center.y)
            .addAll(this.featuresInRegion)
    }

    // Map uses a hybrid approach to mouseover
    // If mouse is inside an element, that is prioritized
    // Otherwise we do a quadtree search for the closest center point of a feature bounds,
    // so that we can hover very small countries without trouble
    @action.bound private detectNearbyFeature(
        event: MouseEvent | TouchEvent
    ): MapRenderFeature | undefined {
        if (this.hoverEnterFeature || !this.base.current) return

        const nearbyFeature = detectNearbyFeature({
            quadtree: this.quadtree,
            element: this.base.current,
            event,
        })

        if (!nearbyFeature) {
            this.hoverNearbyFeature = undefined
            this.manager.onMapMouseLeave()
            return
        }

        if (nearbyFeature.id !== this.hoverNearbyFeature?.id) {
            this.hoverNearbyFeature = nearbyFeature
            this.manager.onMapMouseOver(nearbyFeature.geo)
        }

        return nearbyFeature
    }

    @action.bound private onMouseMove(event: MouseEvent): void {
        if (event.shiftKey) this.showSelectedStyle = true // Turn on highlight selection. To turn off, user can switch tabs.
        this.detectNearbyFeature(event)
    }

    @action.bound private onMouseEnter(feature: MapRenderFeature): void {
        this.setHoverEnterFeature(feature)
    }

    @action.bound private onMouseLeave(): void {
        // Fixes an issue where clicking on a country that overlaps with the
        // tooltip causes the tooltip to disappear shortly after being rendered
        if (this.isTouchDevice) return

        this.clearHoverEnterFeature()
    }

    @action.bound private setHoverEnterFeature(
        feature: MapRenderFeature
    ): void {
        if (this.hoverEnterFeature?.id === feature.id) return

        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver(feature.geo)
    }

    @action.bound private clearHoverEnterFeature(): void {
        this.hoverEnterFeature = undefined
        this.manager.onMapMouseLeave()
    }

    @action.bound private onTouchStart(feature: MapRenderFeature): void {
        this.setHoverEnterFeature(feature)
    }

    @action.bound private onClick(
        feature: MapRenderFeature,
        event: MouseEvent
    ): void {
        this.setHoverEnterFeature(feature)
        this.manager.onClick(feature.geo, event)
    }

    @action.bound private onDocumentClick(): void {
        if (this.hoverEnterFeature || this.hoverNearbyFeature) {
            this.hoverEnterFeature = undefined
            this.hoverNearbyFeature = undefined
            this.manager.onMapMouseLeave()
        }
    }

    private hasFocus(featureId: string): boolean {
        const { focusEntity, focusBracket } = this.manager
        const series = this.choroplethData.get(featureId)
        return hasFocus({ featureId, series, focusEntity, focusBracket })
    }

    private getFocusState(featureId: string): InteractionState {
        const isFocused = this.hasFocus(featureId)
        return {
            active: isFocused,
            background: !!this.manager.focusBracket && !isFocused,
        }
    }

    renderFeaturesOutsideRegion(): React.ReactElement | void {
        if (this.featuresOutsideOfSelectedRegion.length === 0) return

        const strokeWidth = DEFAULT_STROKE_WIDTH / this.viewportScaleSqrt

        return (
            <g id={makeIdForHumanConsumption("countries-outside-selection")}>
                {this.featuresOutsideOfSelectedRegion.map((feature) => (
                    <CountryOutsideOfSelectedRegion
                        key={feature.id}
                        feature={feature}
                        strokeWidth={strokeWidth}
                    />
                ))}
            </g>
        )
    }

    renderFeaturesWithoutData(): React.ReactElement | void {
        if (this.featuresWithNoData.length === 0) return

        // Ids should be unique per document (!) not just a grapher instance -
        // we disregard this for other patterns that are defined the same everywhere
        // because id collisions there are benign but here the pattern will be different
        // depending on the region/projection so we include this in the id
        const patternId = `${Patterns.noDataPatternForMapChart}-${this.region}`

        return (
            <g
                id={makeIdForHumanConsumption("countries-without-data")}
                className="noDataFeatures"
            >
                <defs>
                    <NoDataPattern
                        patternId={patternId}
                        scale={1 / this.viewportScale} // The scale is crucial and projection specific
                    />
                </defs>

                {this.featuresWithNoData.map((feature) => (
                    <CountryWithNoData
                        key={feature.id}
                        feature={feature}
                        patternId={patternId}
                        focus={this.getFocusState(feature.id)}
                        strokeScale={this.viewportScaleSqrt}
                        onClick={(event) =>
                            this.onClick(feature, event.nativeEvent)
                        }
                        onTouchStart={() => this.onTouchStart(feature)}
                        onMouseEnter={this.onMouseEnter}
                        onMouseLeave={this.onMouseLeave}
                    />
                ))}
            </g>
        )
    }

    renderFeaturesWithData(): React.ReactElement | void {
        if (this.featuresWithData.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("countries-with-data")}>
                {this.featuresWithData.map((feature) => {
                    const series = this.choroplethData.get(feature.id)
                    if (!series) return null
                    return (
                        <CountryWithData
                            key={feature.id}
                            feature={feature}
                            series={series}
                            focus={this.getFocusState(feature.id)}
                            strokeScale={this.viewportScaleSqrt}
                            showSelectedStyle={this.showSelectedStyle}
                            onClick={(event) =>
                                this.onClick(feature, event.nativeEvent)
                            }
                            onTouchStart={() => this.onTouchStart(feature)}
                            onMouseEnter={this.onMouseEnter}
                            onMouseLeave={this.onMouseLeave}
                        />
                    )
                })}
            </g>
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("map")}
                transform={this.matrixTransform}
            >
                {this.renderFeaturesOutsideRegion()}
                {this.renderFeaturesWithoutData()}
                {this.renderFeaturesWithData()}
            </g>
        )
    }

    componentDidMount(): void {
        document.addEventListener("touchstart", this.onDocumentClick, true)
    }

    componentWillUnmount(): void {
        document.removeEventListener("touchstart", this.onDocumentClick, true)
    }

    renderInteractive(): React.ReactElement {
        const { bounds, matrixTransform } = this

        // this needs to be referenced here or it will be recomputed on every mousemove
        const _cachedCentroids = this.quadtree

        // SVG layering is based on order of appearance in the element tree (later elements rendered on top)
        // The ordering here is quite careful
        return (
            <g
                ref={this.base}
                className={CHOROPLETH_MAP_CLASSNAME}
                onMouseDown={
                    (ev: SVGMouseEvent): void =>
                        ev.preventDefault() /* Without this, title may get selected while shift clicking */
                }
                onMouseMove={(ev: SVGMouseEvent): void =>
                    this.onMouseMove(ev.nativeEvent)
                }
                onMouseLeave={this.onMouseLeave}
                style={{ cursor: this.hoverFeature ? "pointer" : undefined }}
            >
                <rect
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                <g
                    className={GEO_FEATURES_CLASSNAME}
                    transform={matrixTransform}
                >
                    {this.renderFeaturesOutsideRegion()}
                    {this.renderFeaturesWithoutData()}
                    {this.renderFeaturesWithData()}
                </g>
            </g>
        )
    }

    render(): React.ReactElement {
        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}
