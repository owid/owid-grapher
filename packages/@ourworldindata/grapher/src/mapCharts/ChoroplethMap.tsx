import React from "react"
import {
    Bounds,
    getRelativeMouse,
    sortBy,
    difference,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Quadtree, quadtree } from "d3-quadtree"
import {
    MapEntity,
    ChoroplethMapManager,
    RenderFeature,
    ChoroplethSeries,
    MAP_HOVER_TARGET_RANGE,
    DEFAULT_STROKE_COLOR,
    CHOROPLETH_MAP_CLASSNAME,
} from "./MapChartConstants"
import { Patterns } from "../core/GrapherConstants"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { getCountriesByProjection } from "./WorldRegionsToProjection"
import { MapProjectionName } from "@ourworldindata/types"
import { geoBoundsFor, renderFeaturesFor } from "./GeoFeatures"

declare type SVGMouseEvent = React.MouseEvent<SVGElement>

@observer
export class ChoroplethMap extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    private focusStrokeColor = "#111"

    private defaultStrokeWidth = 0.3
    private focusStrokeWidth = 1.5
    private selectedStrokeWidth = 1
    private patternStrokeWidth = 0.7

    private blurFillOpacity = 0.2
    private blurStrokeOpacity = 0.5

    @computed private get manager(): ChoroplethMapManager {
        return this.props.manager
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

    // Viewport for each projection, defined by center and width+height in fractional coordinates
    @computed private get viewport(): {
        x: number
        y: number
        width: number
        height: number
    } {
        const viewports = {
            World: { x: 0.565, y: 0.5, width: 1, height: 1 },
            Europe: { x: 0.53, y: 0.22, width: 0.2, height: 0.2 },
            Africa: { x: 0.49, y: 0.7, width: 0.21, height: 0.38 },
            NorthAmerica: { x: 0.49, y: 0.4, width: 0.19, height: 0.32 },
            SouthAmerica: { x: 0.52, y: 0.815, width: 0.1, height: 0.26 },
            Asia: { x: 0.74, y: 0.45, width: 0.36, height: 0.5 },
            Oceania: { x: 0.51, y: 0.75, width: 0.1, height: 0.2 },
        }

        return viewports[this.manager.projection]
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
            renderFeaturesFor(this.manager.projection),
            this.featuresInProjection
        )
    }

    @computed private get featuresInProjection(): RenderFeature[] {
        const { projection } = this.manager
        const features = renderFeaturesFor(projection)
        if (projection === MapProjectionName.World) return features

        const countriesByProjection = getCountriesByProjection(projection)
        if (countriesByProjection === undefined) return []

        return features.filter((feature) =>
            countriesByProjection.has(feature.id)
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
            .x(({ center }) => center.x)
            .y(({ center }) => center.y)
            .addAll(this.featuresInProjection)
    }

    @observable private hoverEnterFeature?: RenderFeature
    @observable private hoverNearbyFeature?: RenderFeature
    @action.bound private onMouseMove(ev: React.MouseEvent<SVGGElement>): void {
        if (ev.shiftKey) this.showSelectedStyle = true // Turn on highlight selection. To turn off, user can switch tabs.
        if (this.hoverEnterFeature) return

        const subunits = this.base.current?.querySelector(".subunits")
        if (subunits) {
            const { x, y } = getRelativeMouse(subunits, ev)
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

    @action.bound private onMouseEnter(feature: RenderFeature): void {
        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver(feature.geo)
    }

    @action.bound private onMouseLeave(): void {
        this.hoverEnterFeature = undefined
        this.manager.onMapMouseLeave()
    }

    @computed private get hoverFeature(): RenderFeature | undefined {
        return this.hoverEnterFeature || this.hoverNearbyFeature
    }

    @action.bound private onClick(ev: React.MouseEvent<SVGGElement>): void {
        if (this.hoverFeature !== undefined)
            this.manager.onClick(this.hoverFeature.geo, ev)
    }

    // If true selected countries will have an outline
    @observable private showSelectedStyle = false

    renderFeaturesOutsideProjection(): React.ReactElement | void {
        if (this.featuresOutsideProjection.length === 0) return

        const strokeWidth = this.defaultStrokeWidth / this.viewportScale

        return (
            <g
                id={makeIdForHumanConsumption("countries-outside-selection")}
                className="nonProjectionFeatures"
            >
                {this.featuresOutsideProjection.map((feature) => (
                    <path
                        key={feature.id}
                        id={makeIdForHumanConsumption(feature.id)}
                        d={feature.path}
                        strokeWidth={strokeWidth}
                        stroke="#aaa"
                        fill="#fff"
                    />
                ))}
            </g>
        )
    }

    renderFeaturesWithoutData(): React.ReactElement | void {
        if (this.featuresWithNoData.length === 0) return
        return (
            <g
                id={makeIdForHumanConsumption("countries-without-data")}
                className="noDataFeatures"
            >
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
                        <path
                            d="M -1,2 l 6,0"
                            stroke="#ccc"
                            strokeWidth={this.patternStrokeWidth}
                        />
                    </pattern>
                </defs>

                {this.featuresWithNoData.map((feature) => {
                    const isFocus = this.hasFocus(feature.id)
                    const outOfFocusBracket = !!this.focusBracket && !isFocus
                    const stroke = isFocus ? this.focusStrokeColor : "#aaa"
                    const fillOpacity = outOfFocusBracket
                        ? this.blurFillOpacity
                        : 1
                    const strokeOpacity = outOfFocusBracket
                        ? this.blurStrokeOpacity
                        : 1
                    const strokeWidth =
                        (isFocus
                            ? this.focusStrokeWidth
                            : this.defaultStrokeWidth) / this.viewportScale
                    return (
                        <path
                            key={feature.id}
                            id={makeIdForHumanConsumption(feature.id)}
                            d={feature.path}
                            strokeWidth={strokeWidth}
                            stroke={stroke}
                            strokeOpacity={strokeOpacity}
                            cursor="pointer"
                            fill={`url(#${Patterns.noDataPatternForMapChart}-${this.manager.projection})`}
                            fillOpacity={fillOpacity}
                            onClick={(ev: SVGMouseEvent): void =>
                                this.manager.onClick(feature.geo, ev)
                            }
                            onMouseEnter={(): void =>
                                this.onMouseEnter(feature)
                            }
                            onMouseLeave={this.onMouseLeave}
                        />
                    )
                })}
            </g>
        )
    }

    renderFeaturesWithData(): React.ReactElement | void {
        if (this.featuresWithData.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("countries-with-data")}>
                {sortBy(
                    this.featuresWithData.map((feature) => {
                        const isFocus = this.hasFocus(feature.id)
                        const showSelectedStyle =
                            this.showSelectedStyle &&
                            this.isSelected(feature.id)
                        const outOfFocusBracket =
                            !!this.focusBracket && !isFocus
                        const series = this.choroplethData.get(
                            feature.id as string
                        )
                        const stroke =
                            isFocus || showSelectedStyle
                                ? this.focusStrokeColor
                                : DEFAULT_STROKE_COLOR
                        const fill = series ? series.color : this.defaultFill
                        const fillOpacity = outOfFocusBracket
                            ? this.blurFillOpacity
                            : 1
                        const strokeOpacity = outOfFocusBracket
                            ? this.blurStrokeOpacity
                            : 1
                        const strokeWidth =
                            (isFocus
                                ? this.focusStrokeWidth
                                : showSelectedStyle
                                  ? this.selectedStrokeWidth
                                  : this.defaultStrokeWidth) /
                            this.viewportScale

                        return (
                            <path
                                key={feature.id}
                                id={makeIdForHumanConsumption(feature.id)}
                                d={feature.path}
                                strokeWidth={strokeWidth}
                                stroke={stroke}
                                strokeOpacity={strokeOpacity}
                                cursor="pointer"
                                fill={fill}
                                fillOpacity={fillOpacity}
                                onClick={(ev: SVGMouseEvent): void =>
                                    this.manager.onClick(feature.geo, ev)
                                }
                                onMouseEnter={(): void =>
                                    this.onMouseEnter(feature)
                                }
                                onMouseLeave={this.onMouseLeave}
                            />
                        )
                    }),
                    (p) => p.props["strokeWidth"]
                )}
            </g>
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("map")}
                transform={this.matrixTransform}
            >
                {this.renderFeaturesOutsideProjection()}
                {this.renderFeaturesWithoutData()}
                {this.renderFeaturesWithData()}
            </g>
        )
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
                <g className="subunits" transform={matrixTransform}>
                    {this.renderFeaturesOutsideProjection()}
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
