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
import {
    makeIdForHumanConsumption,
    clamp,
    difference,
    Bounds,
    sortBy,
    InteractionState,
    isTouchDevice,
} from "@ourworldindata/utils"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import {
    ChoroplethMapManager,
    ChoroplethData,
    GEO_FEATURES_CLASSNAME,
    GlobeRenderFeature,
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
import { detectNearbyFeature, hasFocus } from "./MapHelpers"

const DEFAULT_GLOBE_SIZE = 500 // defined by d3

@observer
export class ChoroplethGlobe extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    /** Show an outline for selected countries */
    @observable private showSelectedStyle = false

    @observable private hoverEnterFeature?: GlobeRenderFeature
    @observable private hoverNearbyFeature?: GlobeRenderFeature

    private isDragging = false
    private isPinching = false
    private firstScreenX?: number
    private firstScreenY?: number
    private previousScreenX?: number
    private previousScreenY?: number
    private previousDistance?: number // for pinch gesture

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

    @computed.struct private get choroplethData(): ChoroplethData {
        return this.manager.choroplethData
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
        event: MouseEvent | TouchEvent
    ): void {
        if (this.hoverEnterFeature) return

        if (!this.base.current) return
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
        const defaultScale = geoOrthographic().scale()
        return (
            this.zoomScale *
            defaultScale *
            (this.globeSize / DEFAULT_GLOBE_SIZE)
        )
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

        // the feature is visible if the cosine is positive
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
    @action.bound private rotateGlobe(
        startCoords: [number, number],
        endCoords: [number, number]
    ): void {
        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
        this.rotateFrameId = requestAnimationFrame(() => {
            const dx = endCoords[0] - startCoords[0]
            const dy = endCoords[1] - startCoords[1]

            // if the user drags a distance equal to the circumference
            // of the globe, the globe should rotate by 360 degrees
            const globeCircumference = Math.PI * this.globeSize
            let sensitivity = 360 / globeCircumference

            // increase sensitivity on touch devices
            if (this.isTouchDevice) sensitivity *= 1.5

            // slower rotation when zoomed in
            sensitivity /= this.zoomScale

            const [rx, ry] = this.projection.rotate()
            this.mapConfig.globe.rotation = [
                rx + dx * sensitivity,
                clamp(ry - dy * sensitivity, -90, 90),
            ]
        })
    }

    @action.bound private clearHover(): void {
        if (this.hoverEnterFeature || this.hoverNearbyFeature) {
            this.hoverEnterFeature = undefined
            this.hoverNearbyFeature = undefined
            this.manager.onMapMouseLeave()
        }
    }

    @action.bound private startDragging(): void {
        this.isDragging = true

        // dismiss tooltip
        this.clearHover()

        // update cursor style
        document.body.style.cursor = "move"
    }

    @action.bound private stopDragging(): void {
        this.isDragging = false
        this.firstScreenX = undefined
        this.firstScreenY = undefined
        this.previousScreenX = undefined
        this.previousScreenY = undefined

        // reset cursor style
        document.body.style.cursor = "default"
    }

    @action.bound private onDrag(event: MouseEvent | TouchEvent): void {
        const { screenX, screenY } = getScreenCoords(event)

        // dismiss tooltip
        this.clearHover()

        // return early if no previous screen coords are given
        if (
            this.previousScreenX === undefined ||
            this.previousScreenY === undefined
        ) {
            this.previousScreenX = screenX
            this.previousScreenY = screenY
            return
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

    @action.bound private startPinching(): void {
        this.isPinching = true

        // dismiss tooltip
        this.clearHover()
    }

    @action.bound private stopPinching(): void {
        this.isPinching = false
        this.previousDistance = undefined
        this.clearHover()
    }

    // todo: remove boolean result
    @action.bound private onPinch(event: TouchEvent): void {
        // need at least two touch points for pinch
        if (event.touches.length < 2) {
            this.stopPinching()
            return
        }

        // dismiss tooltip
        this.clearHover()

        // calculate the distance between the first two touch points
        const touch1 = event.touches[0]
        const touch2 = event.touches[1]
        const distance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
        )

        // if this is the first multi-touch event, just store the distance
        if (this.previousDistance === undefined) {
            this.previousDistance = distance
            return
        }

        // calculate the zoom factor based on the change in distance
        const zoomFactor = 0.01
        const delta = distance - this.previousDistance
        const newScale = this.zoomScale * (1 + delta * zoomFactor)

        // update state
        this.mapConfig.globe.zoom = clamp(newScale, 1, 3)
        this.previousDistance = distance
    }

    @action.bound private onMouseDown(event: MouseEvent): void {
        event.preventDefault() // prevent text selection

        this.wasDragging = false

        // register mousemove and mouseup events on the document
        // so that dragging continues if the mouse leaves the map
        document.addEventListener("mousemove", this.onMouseDrag, {
            passive: true,
        })
        document.addEventListener("mouseup", this.onMouseUp, {
            passive: true,
        })
    }

    private wasDragging = false

    @action.bound private onMouseDrag(event: MouseEvent): void {
        console.log("mouse drag")
        this.wasDragging = true
        this.startDragging()
        this.onDrag(event)
    }

    @action.bound private onMouseUp(event: MouseEvent): void {
        console.log("mouse up")
        this.stopDragging()

        if (this.wasDragging) {
            // Keep the flag for a short time to prevent the click
            setTimeout(() => {
                this.wasDragging = false
            }, 300) // Adjust timing as needed
        }

        document.removeEventListener("mousemove", this.onMouseDrag)
        document.removeEventListener("mouseup", this.onMouseUp)
    }

    @action.bound private onTouchStart(event: TouchEvent): void {
        console.log("touch start")

        event.preventDefault() // prevent scrolling and page zoom

        // reset pinching and dragging state
        this.stopPinching()
        this.stopDragging()

        // if this is a pinch gesture, handle it and return early
        if (event.touches.length >= 2) {
            this.onPinch(event)
            return // todo: this is new
        }

        // store coords for the touch event
        const { screenX, screenY } = getScreenCoords(event)
        this.firstScreenX = screenX
        this.firstScreenY = screenY
        this.previousScreenX = screenX
        this.previousScreenY = screenY

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
        console.log("touch move")

        event.preventDefault() // prevent scrolling

        // dismiss tooltip
        this.clearHover()

        // todo: this has been removed
        // First check if this is a pinch gesture
        if (event.touches.length >= 2) {
            if (!this.isPinching) this.startPinching()
            this.onPinch(event)
            // If we handled it as a pinch, don't process as drag
            return
        }

        if (this.isPinching) this.stopPinching()

        // start dragging if movement is detected
        if (
            !this.isDragging &&
            this.firstScreenX !== undefined &&
            this.firstScreenY !== undefined
        ) {
            const { screenX, screenY } = getScreenCoords(event)
            const dx = screenX - this.firstScreenX
            const dy = screenY - this.firstScreenY
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance > 5) this.startDragging()
        }

        if (this.isDragging) this.onDrag(event)
    }

    @action.bound private onTouchEnd(event: TouchEvent): void {
        console.log("touch end", { isDragging: this.isDragging })

        if (this.isPinching) {
            this.stopPinching()
        }

        if (this.isDragging) {
            this.stopDragging()
        } else {
            // if the touch event was a tap, fire a click event.
            console.log("dispatching click event")
            event.target?.dispatchEvent(
                new MouseEvent("click", { bubbles: true })
            )
        }

        if (this.base.current) {
            this.base.current.removeEventListener("touchmove", this.onTouchMove)
            this.base.current.removeEventListener("touchend", this.onTouchEnd)
            this.base.current.removeEventListener(
                "touchcancel",
                this.onTouchEnd
            )
        }
    }

    @action.bound private onMouseMove(event: MouseEvent): void {
        if (event.shiftKey) this.showSelectedStyle = true // Turn on highlight selection. To turn off, user can switch tabs.
        if (!this.isDragging) this.detectNearbyFeature(event)
    }

    @action.bound private onMouseEnter(feature: GlobeRenderFeature): void {
        // console.log("mouse enter", { dragging: this.isDragging })

        // don't show tooltips while dragging
        if (this.isDragging) {
            this.clearHover()
            return
        }

        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver(feature.geo)
    }

    @action.bound private onMouseLeave(): void {
        this.hoverEnterFeature = undefined
        this.manager.onMapMouseLeave()
    }

    @action.bound private onClick(event: SVGMouseEvent): void {
        if (this.wasDragging) {
            event.stopPropagation()
            return
        }

        // find the feature that was clicked
        const featureId = (event.target as SVGElement).id
        const feature = this.features.find(
            (f) => makeIdForHumanConsumption(f.id) === featureId
        )

        console.log("click", {
            dragging: this.isDragging,
            featureId: feature?.id,
        })
        if (!feature) return

        // update hover state
        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver(feature.geo)

        this.manager.onClick(feature.geo, event)
    }

    @action.bound private onWheel(event: WheelEvent): void {
        event.preventDefault() // prevent scrolling

        // determine zoom direction and amount
        const delta = -event.deltaY

        // adjust zoom scale
        const zoomFactor = 0.03
        const newScale =
            this.zoomScale * (1 + (delta > 0 ? zoomFactor : -zoomFactor))

        this.mapConfig.globe.zoom = clamp(newScale, 1, 3)
    }

    async componentDidMount(): Promise<void> {
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
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
                { passive: false }
            )
            this.base.current.addEventListener("wheel", this.onWheel, {
                passive: false,
            })
        }
    }

    @action.bound onDocumentClick(): void {
        this.clearHover()
    }

    componentWillUnmount(): void {
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
        if (this.base.current) {
            this.base.current.removeEventListener("mousedown", this.onMouseDown)
            this.base.current.removeEventListener("mousemove", this.onMouseMove)
            this.base.current.removeEventListener(
                "touchstart",
                this.onTouchStart
            )
            this.base.current.removeEventListener("wheel", this.onWheel)
        }

        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
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
                    stroke="green"
                />
                <path
                    id={makeIdForHumanConsumption("globe-graticule")}
                    d={this.graticule}
                    stroke="#f2f2f2"
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
                        onClick={this.onClick}
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
                            path={this.getPath(feature)}
                            focus={this.getFocusState(feature.id)}
                            showSelectedStyle={this.showSelectedStyle}
                            onClick={this.onClick}
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
            <g ref={this.base} style={{ touchAction: "pinch-zoom" }}>
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
