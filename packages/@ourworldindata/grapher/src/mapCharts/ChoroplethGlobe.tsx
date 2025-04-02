import React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    geoGraticule,
    geoOrthographic,
    GeoPath,
    geoPath,
    GeoPermissibleObjects,
} from "d3-geo"
import { Quadtree, quadtree } from "d3-quadtree"
import { select } from "d3-selection"
import { zoom } from "d3-zoom"
// @ts-expect-error no types available
import versor from "versor"
import {
    makeIdForHumanConsumption,
    clamp,
    difference,
    Bounds,
    sortBy,
    InteractionState,
    isTouchDevice,
    getRelativeMouse,
    checkIsTouchEvent,
} from "@ourworldindata/utils"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import {
    ChoroplethMapManager,
    ChoroplethSeriesByName,
    GEO_FEATURES_CLASSNAME,
    GlobeRenderFeature,
    MAP_HOVER_TARGET_RANGE,
    SVGMouseEvent,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { getFeaturesForGlobe } from "./GeoFeatures"
import {
    CountryWithData,
    CountryWithNoData,
    NoDataPattern,
} from "./MapComponents"
import { Patterns } from "../core/GrapherConstants"
import { calculateDistance, detectNearbyFeature, hasFocus } from "./MapHelpers"

const DEFAULT_GLOBE_SIZE = 500 // defined by d3

const MIN_ZOOM_SCALE = 1
const MAX_ZOOM_SCALE = 5

@observer
export class ChoroplethGlobe extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    /** Show an outline for selected countries */
    @observable private showSelectedStyle = false

    @observable private hoverEnterFeature?: GlobeRenderFeature
    @observable private hoverNearbyFeature?: GlobeRenderFeature

    private isPanningOrZooming = false

    @computed private get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    @computed private get manager(): ChoroplethMapManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig
    }

    @computed.struct private get bounds(): Bounds {
        return this.manager.choroplethMapBounds
    }

    @computed.struct private get choroplethData(): ChoroplethSeriesByName {
        return this.manager.choroplethData
    }

    @computed private get hoverFeature(): GlobeRenderFeature | undefined {
        return this.hoverEnterFeature || this.hoverNearbyFeature
    }

    @computed private get features(): GlobeRenderFeature[] {
        return getFeaturesForGlobe()
    }

    @computed private get featuresWithData(): GlobeRenderFeature[] {
        const features = this.features.filter((feature) =>
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

    @computed private get featuresWithNoData(): GlobeRenderFeature[] {
        return difference(this.features, this.featuresWithData)
    }

    // Map uses a hybrid approach to mouseover
    // If mouse is inside an element, that is prioritized
    // Otherwise we do a quadtree search for the closest center point of a feature bounds,
    // so that we can hover very small countries without trouble
    @action.bound private detectNearbyFeature(
        event: MouseEvent | TouchEvent,
        maxDistance = MAP_HOVER_TARGET_RANGE
    ): GlobeRenderFeature | undefined {
        if (this.hoverEnterFeature || !this.base.current) return

        const nearbyFeature = detectNearbyFeature({
            quadtree: this.quadtree,
            element: this.base.current,
            event,
            distance: maxDistance,
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

    /** Checks if a geo entity is currently focused, either directly or via the bracket */
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

    @computed private get globeSize(): number {
        return Math.min(this.bounds.width, this.bounds.height)
    }

    @computed private get globeCenter(): [number, number] {
        return [
            this.bounds.left + this.bounds.width / 2,
            this.bounds.top + this.bounds.height / 2,
        ]
    }

    @computed private get globeScale(): number {
        const { globeSize, zoomScale } = this
        const currentScale = geoOrthographic().scale()
        return zoomScale * currentScale * (globeSize / DEFAULT_GLOBE_SIZE)
    }

    @computed private get globeRotation(): [number, number] {
        return this.mapConfig.globe.rotation
    }

    @computed private get zoomScale(): number {
        return this.mapConfig.globe.zoom
    }

    @computed private get projection(): any {
        return geoOrthographic()
            .scale(this.globeScale)
            .translate(this.globeCenter)
            .rotate(this.globeRotation)
    }

    private pathContext = new GeoPathRoundingContext()
    @computed private get globePath(): GeoPath<any, GeoPermissibleObjects> {
        return geoPath().projection(this.projection).context(this.pathContext)
    }

    private getPath(feature: GlobeRenderFeature): string {
        this.pathContext.beginPath()
        this.globePath(feature.geo)
        return this.pathContext.result()
    }

    /** Check if a country is visible on the rendered 3d globe from the current viewing angle */
    private isFeatureVisibleOnGlobe(feature: GlobeRenderFeature): boolean {
        const { globeRotation } = this
        const { centroid } = feature

        const toRadians = (degree: number): number => (degree * Math.PI) / 180

        // convert centroid degrees to radians
        const lambda = toRadians(centroid[0])
        const phi = toRadians(centroid[1])

        // get current rotation in radians
        const rotationLambda = toRadians(-globeRotation[0])
        const rotationPhi = toRadians(-globeRotation[1])

        // calculate the cosine of the angular distance between the feature's
        // center point and the center points of the current view
        const cosDelta =
            Math.sin(phi) * Math.sin(rotationPhi) +
            Math.cos(phi) *
                Math.cos(rotationPhi) *
                Math.cos(lambda - rotationLambda)

        return cosDelta > 0
    }

    @computed private get graticule(): string {
        const graticule = geoGraticule().step([10, 10])()
        this.pathContext.beginPath()
        this.globePath(graticule)
        return this.pathContext.result()
    }

    @computed private get visibleFeatures(): GlobeRenderFeature[] {
        return this.features.filter((feature) =>
            this.isFeatureVisibleOnGlobe(feature)
        )
    }

    @computed private get quadtree(): Quadtree<GlobeRenderFeature> {
        return quadtree<GlobeRenderFeature>()
            .x((feature) => this.projection(feature.centroid)[0])
            .y((feature) => this.projection(feature.centroid)[1])
            .addAll(this.visibleFeatures)
    }

    private rotateFrameId: number | undefined
    @action.bound private rotateGlobe(targetCoords: [number, number]): void {
        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
        this.rotateFrameId = requestAnimationFrame(() => {
            this.mapConfig.globe.rotation = [
                targetCoords[0],
                clamp(targetCoords[1], -90, 90),
            ]
        })
    }

    private zoomFrameId: number | undefined
    @action.bound private zoomGlobe(delta: number): void {
        if (this.zoomFrameId) cancelAnimationFrame(this.zoomFrameId)
        this.zoomFrameId = requestAnimationFrame(() => {
            const sensitivity = 0.01
            const newZoom = this.zoomScale * (1 + delta * sensitivity)
            this.mapConfig.globe.zoom = clamp(
                newZoom,
                MIN_ZOOM_SCALE,
                MAX_ZOOM_SCALE
            )
        })
    }

    @action.bound private clearHover(): void {
        if (this.hoverEnterFeature || this.hoverNearbyFeature) {
            this.hoverEnterFeature = undefined
            this.hoverNearbyFeature = undefined
            this.manager.onMapMouseLeave()
        }
    }

    @action.bound private onMouseMove(event: MouseEvent): void {
        if (event.shiftKey) this.showSelectedStyle = true // Turn on highlight selection. To turn off, user can switch tabs.
        this.detectNearbyFeature(event)
    }

    @action.bound private onMouseEnterFeature(
        feature: GlobeRenderFeature
    ): void {
        // ignore mouse enter if panning or zooming
        if (this.isPanningOrZooming) return
        this.setHoverEnterFeature(feature)
    }

    @action.bound private onMouseLeaveFeature(): void {
        this.clearHoverEnterFeature()
    }

    @action.bound private setHoverEnterFeature(
        feature: GlobeRenderFeature
    ): void {
        if (this.hoverEnterFeature?.id === feature.id) return

        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver(feature.geo)
    }

    @action.bound private clearHoverEnterFeature(): void {
        this.hoverEnterFeature = undefined
        this.manager.onMapMouseLeave()
    }

    @action.bound private onClick(
        feature: GlobeRenderFeature,
        event: MouseEvent
    ): void {
        this.setHoverEnterFeature(feature)
        this.manager.onClick(feature.geo, event)
    }

    @action.bound private onTouchStart(feature: GlobeRenderFeature): void {
        this.setHoverEnterFeature(feature)
    }

    @action.bound private onDocumentClick(): void {
        this.clearHover()
    }

    private setUpPanningAndZooming(): void {
        const base = this.base.current
        if (!base) return

        // possible interaction types are
        // - zoom-scroll: zooming by scrolling via the wheel event
        // - zoom-pinch: zooming by pinching using two fingers on touch devices
        // - pan: panning by dragging the mouse or using a finger on touch devices
        type InteractionType = "zoom-scroll" | "zoom-pinch" | "pan"

        // Panning and zooming is powered by D3.
        //
        // Panning is adapted from https://observablehq.com/d/569d101dd5bd332b.
        // The strategy ensures the geographic start point remains under the cursor
        // where possible. See https://www.jasondavies.com/maps/rotate/ for more
        // details.
        //
        // We could rely on D3's event.transform.k for zooming, but the
        // transform value might be out of sync with the actual zoom level if
        // the zoom level was changed elsewhere (e.g. by automatically zooming
        // in on a country). That's why we compute the target zoom level ourselves.

        const panAndZoom = (): any => {
            let previousType: InteractionType | undefined

            // for panning
            let startCoords: [number, number, number],
                startQuat: [number, number, number, number],
                startRot: [number, number]

            // for zooming
            let startDistance: number | undefined

            const getInteractionType = (event: any): InteractionType => {
                if (event.sourceEvent.type === "wheel") return "zoom-scroll"
                if (isMultiTouchEvent(event.sourceEvent)) return "zoom-pinch"
                return "pan"
            }

            const panningOrZoomingStart = (event: any): void => {
                const type = getInteractionType(event)

                const startPinching = (): void => {
                    startDistance = calculatePinchDistance(event.sourceEvent)
                }

                const startPanning = (): void => {
                    const pos = getRelativeMouse(base, event.sourceEvent)
                    startCoords = versor.cartesian(
                        this.projection.invert([pos.x, pos.y])
                    )
                    startRot = this.globeRotation
                    startQuat = versor(startRot)
                }

                if (type === "zoom-pinch") startPinching()
                else if (type === "pan") startPanning()

                previousType = type
            }

            const panningOrZooming = (event: any): void => {
                this.isPanningOrZooming = true
                this.clearHover() // dismiss the tooltip

                const wheeling = (): void => {
                    this.zoomGlobe(-event.sourceEvent.deltaY)
                }

                const pinching = (): void => {
                    const distance = calculatePinchDistance(event.sourceEvent)

                    if (!startDistance) {
                        startDistance = distance
                        return
                    }

                    const delta = distance - startDistance

                    // We sometimes get two events for the same pinch gesture,
                    // with one of the events having a delta of 0. We simply
                    // ignore the delta-0 events. This fixes a bug where the
                    // rendered SVG country paths would interfere with the
                    // pinch-to-zoom gesture.
                    if (delta === 0) return

                    this.zoomGlobe(delta)
                    startDistance = distance
                }

                const panning = (): void => {
                    const pos = getRelativeMouse(base, event.sourceEvent)
                    const currCoords = versor.cartesian(
                        this.projection.rotate(startRot).invert([pos.x, pos.y])
                    )
                    const delta = versor.delta(startCoords, currCoords)
                    const quat = versor.multiply(startQuat, delta)
                    const rotation = versor.rotation(quat)

                    // ignore the gamma channel for more intuitive rotation
                    // see https://observablehq.com/@d3/three-axis-rotation
                    // for a visual explanation of three-axis rotation
                    this.rotateGlobe([rotation[0], rotation[1]])
                }

                const type = getInteractionType(event)

                // bail if a zoom-pinch gesture turned into a pan
                // because this might lead to erratic jumps
                if (previousType === "zoom-pinch" && type === "pan") return

                if (type === "zoom-scroll") wheeling()
                else if (type === "zoom-pinch") pinching()
                else if (type === "pan") panning()

                previousType = type
            }

            const panningOrZoomingEnd = (): void => {
                this.isPanningOrZooming = false
                startDistance = undefined
                previousType = undefined
            }

            return zoom()
                .scaleExtent([MIN_ZOOM_SCALE, MAX_ZOOM_SCALE])
                .touchable(() => this.isTouchDevice)
                .on("start", panningOrZoomingStart)
                .on("zoom", panningOrZooming)
                .on("end", panningOrZoomingEnd)
        }

        select(base).call(panAndZoom())
    }

    componentDidMount(): void {
        document.addEventListener("touchstart", this.onDocumentClick, true)

        this.setUpPanningAndZooming()
    }

    componentWillUnmount(): void {
        document.removeEventListener("touchstart", this.onDocumentClick, true)

        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
        if (this.zoomFrameId) cancelAnimationFrame(this.zoomFrameId)
    }

    renderGlobeOutline(): React.ReactElement {
        return (
            <>
                <circle
                    id={makeIdForHumanConsumption("globe-sphere")}
                    cx={this.globeCenter[0]}
                    cy={this.globeCenter[1]}
                    r={(this.globeSize / 2) * this.zoomScale}
                    fill="#fafafa"
                />
                <path
                    id={makeIdForHumanConsumption("globe-graticule")}
                    d={this.graticule}
                    stroke="#e7e7e7"
                    strokeWidth={1}
                    fill="none"
                    style={{ pointerEvents: "none" }}
                />
            </>
        )
    }

    renderFeaturesWithNoData(): React.ReactElement | void {
        if (this.featuresWithNoData.length === 0) return
        const patternId = Patterns.noDataPatternForMapChart
        return (
            <g
                id={makeIdForHumanConsumption("countries-without-data")}
                className="noDataFeatures"
            >
                <defs>
                    <NoDataPattern patternId={patternId} />
                </defs>

                {this.featuresWithNoData.map((feature) => (
                    <CountryWithNoData
                        key={feature.id}
                        feature={feature}
                        path={this.getPath(feature)}
                        patternId={patternId}
                        focus={this.getFocusState(feature.id)}
                        onClick={(event) =>
                            this.onClick(feature, event.nativeEvent)
                        }
                        onTouchStart={() => this.onTouchStart(feature)}
                        onMouseEnter={this.onMouseEnterFeature}
                        onMouseLeave={this.onMouseLeaveFeature}
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
                            path={this.getPath(feature)}
                            focus={this.getFocusState(feature.id)}
                            showSelectedStyle={this.showSelectedStyle}
                            onClick={(event) =>
                                this.onClick(feature, event.nativeEvent)
                            }
                            onTouchStart={() => this.onTouchStart(feature)}
                            onMouseEnter={this.onMouseEnterFeature}
                            onMouseLeave={this.onMouseLeaveFeature}
                        />
                    )
                })}
            </g>
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderGlobeOutline()}
                <g id={makeIdForHumanConsumption("globe")}>
                    {this.renderFeaturesWithNoData()}
                    {this.renderFeaturesWithData()}
                </g>
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        // this needs to be referenced here or it will be recomputed on every mousemove
        const _cachedCentroids = this.quadtree

        return (
            <g
                ref={this.base}
                onMouseDown={
                    (ev: SVGMouseEvent): void =>
                        ev.preventDefault() /* Without this, title may get selected while shift clicking */
                }
                onMouseMove={(ev: SVGMouseEvent): void =>
                    this.onMouseMove(ev.nativeEvent)
                }
                onMouseLeave={this.onMouseLeaveFeature}
                style={{ cursor: this.hoverFeature ? "pointer" : undefined }}
            >
                {this.renderGlobeOutline()}
                <g className={GEO_FEATURES_CLASSNAME}>
                    {this.renderFeaturesWithNoData()}
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

const isMultiTouchEvent = (
    event: MouseEvent | TouchEvent
): event is TouchEvent => {
    return checkIsTouchEvent(event) && event.touches.length >= 2
}

const calculatePinchDistance = (event: TouchEvent): number => {
    const { touches } = event
    return calculateDistance(
        [touches[0].clientX, touches[0].clientY],
        [touches[1].clientX, touches[1].clientY]
    )
}
