import * as _ from "lodash-es"
import React from "react"
import { computed, action, observable, makeObservable } from "mobx"
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
    Bounds,
    isTouchDevice,
    getRelativeMouse,
    checkIsTouchEvent,
    PointVector,
    MapRegionName,
    excludeUndefined,
    EntityName,
} from "@ourworldindata/utils"
import {
    Annotation,
    ANNOTATION_COLOR_DARK,
    ANNOTATION_COLOR_LIGHT,
    ChoroplethMapManager,
    ChoroplethSeriesByName,
    DEFAULT_GLOBE_SIZE,
    ExternalAnnotation,
    GEO_FEATURES_CLASSNAME,
    GLOBE_COUNTRY_ZOOM,
    GLOBE_LATITUDE_MAX,
    GLOBE_LATITUDE_MIN,
    GLOBE_MAX_ZOOM,
    GLOBE_MIN_ZOOM,
    GlobeRenderFeature,
    InternalAnnotation,
    MAP_HOVER_TARGET_RANGE,
    PROJECTED_DATA_LEGEND_COLOR,
    RenderFeature,
    SVGMouseEvent,
} from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { getGeoFeaturesForGlobe } from "./GeoFeatures"
import {
    BackgroundCountry,
    CountryWithData,
    CountryWithNoData,
    ExternalValueAnnotation,
    InternalValueAnnotation,
    NoDataPattern,
    ProjectedDataPattern,
} from "./MapComponents"
import { Patterns } from "../core/GrapherConstants"
import {
    calculateDistance,
    detectNearbyFeature,
    isPointPlacedOnVisibleHemisphere,
    sortFeaturesByInteractionStateAndSize,
    getForegroundFeatures,
    isValidGlobeRegionName,
} from "./MapHelpers"
import {
    makeInternalAnnotationForFeature,
    makeExternalAnnotationForFeature,
    repositionAndFilterExternalAnnotations,
} from "./MapAnnotations"
import * as R from "remeda"
import { GlobeController } from "./GlobeController"
import { isDarkColor } from "../color/ColorUtils"
import { MapSelectionArray } from "../selection/MapSelectionArray"

const DEFAULT_SCALE = geoOrthographic().scale()

@observer
export class ChoroplethGlobe extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base = React.createRef<SVGGElement>()

    private hoverEnterFeature: GlobeRenderFeature | undefined = undefined
    private hoverNearbyFeature: GlobeRenderFeature | undefined = undefined

    private isPanningOrZooming = false

    constructor(props: { manager: ChoroplethMapManager }) {
        super(props)

        makeObservable<
            ChoroplethGlobe,
            "hoverEnterFeature" | "hoverNearbyFeature"
        >(this, {
            hoverEnterFeature: observable,
            hoverNearbyFeature: observable,
        })
    }

    @computed private get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    @computed private get manager(): ChoroplethMapManager {
        return this.props.manager
    }

    @computed get mapConfig(): MapConfig {
        return this.manager.mapConfig
    }

    @computed private get globeController(): GlobeController {
        return this.manager.globeController ?? new GlobeController(this)
    }

    @computed.struct private get bounds(): Bounds {
        return this.manager.choroplethMapBounds
    }

    @computed private get selectionArray(): MapSelectionArray {
        return this.manager.selectionArray ?? new MapSelectionArray()
    }

    @computed.struct private get choroplethData(): ChoroplethSeriesByName {
        return this.manager.choroplethData
    }

    @computed private get features(): GlobeRenderFeature[] {
        return getGeoFeaturesForGlobe()
    }

    @computed private get featuresById(): Map<string, GlobeRenderFeature> {
        return new Map(this.features.map((feature) => [feature.id, feature]))
    }

    @computed private get foregroundFeatures(): GlobeRenderFeature[] {
        return getForegroundFeatures(this.features, this.selectionArray)
    }

    @computed
    private get backgroundFeatures(): GlobeRenderFeature[] {
        return _.difference(this.features, this.foregroundFeatures)
    }

    @computed private get backgroundFeatureIdSet(): Set<EntityName> {
        return new Set(this.backgroundFeatures.map((feature) => feature.id))
    }

    @computed private get featuresWithData(): GlobeRenderFeature[] {
        return this.foregroundFeatures.filter((feature) =>
            this.choroplethData.has(feature.id)
        )
    }

    @computed private get sortedFeaturesWithData(): GlobeRenderFeature[] {
        // sort features so that hovered or selected features are rendered last
        // and smaller countries are rendered on top of bigger ones
        return sortFeaturesByInteractionStateAndSize(this.featuresWithData, {
            isHovered: (featureId: string) =>
                this.manager.getHoverState?.(featureId).active ?? false,
            isSelected: (featureId) =>
                this.manager.isSelected?.(featureId) ?? false,
        })
    }

    @computed private get featuresWithNoData(): GlobeRenderFeature[] {
        return _.difference(this.foregroundFeatures, this.featuresWithData)
    }

    @computed private get binColors(): string[] {
        return this.manager.binColors ?? []
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
            this.manager.onMapMouseLeave?.()
            return
        }

        if (nearbyFeature.id !== this.hoverNearbyFeature?.id) {
            this.hoverNearbyFeature = nearbyFeature
            this.manager.onMapMouseOver?.(nearbyFeature.geo)
        }

        return nearbyFeature
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

    private computeProjectionScale(zoomScale: number): number {
        return zoomScale * DEFAULT_SCALE * (this.globeSize / DEFAULT_GLOBE_SIZE)
    }

    @computed private get minScale(): number {
        return this.computeProjectionScale(GLOBE_MIN_ZOOM)
    }

    @computed private get maxScale(): number {
        return this.computeProjectionScale(GLOBE_MAX_ZOOM)
    }

    @computed private get globeScale(): number {
        return this.computeProjectionScale(this.zoomScale)
    }

    @computed private get globeRadius(): number {
        return (this.globeSize / 2) * this.zoomScale
    }

    @computed private get globeRotation(): [number, number] {
        // d3 projections expect [-lon, -lat] to rotate to [lon, lat]
        return [
            -this.mapConfig.globe.rotation[0],
            -this.mapConfig.globe.rotation[1],
        ]
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

    @computed private get globePath(): GeoPath<any, GeoPermissibleObjects> {
        return geoPath().digits(1).projection(this.projection)
    }

    private getPath(feature: GlobeRenderFeature): string {
        return this.globePath(feature.geo) ?? ""
    }

    private isFeatureCentroidVisibleOnGlobe(
        feature: GlobeRenderFeature,
        threshold = 0 // 1 = at the exact center, 0 = anywhere on the visible hemisphere
    ): boolean {
        return isPointPlacedOnVisibleHemisphere(
            feature.geoCentroid,
            this.mapConfig.globe.rotation,
            threshold
        )
    }

    @computed private get graticulePath(): string {
        const graticule = geoGraticule().step([10, 10])()
        return this.globePath(graticule) ?? ""
    }

    @computed private get equatorPath(): string {
        const equator = geoGraticule().step([0, 360])()
        return this.globePath(equator) ?? ""
    }

    @computed private get visibleFeatures(): GlobeRenderFeature[] {
        return this.foregroundFeatures.filter((feature) =>
            this.isFeatureCentroidVisibleOnGlobe(feature)
        )
    }

    @computed private get quadtree(): Quadtree<GlobeRenderFeature> {
        return quadtree<GlobeRenderFeature>()
            .x((feature) => this.projection(feature.geoCentroid)[0])
            .y((feature) => this.projection(feature.geoCentroid)[1])
            .addAll(this.visibleFeatures)
    }

    @computed private get shouldShowAnnotations(): boolean {
        return !!(
            this.manager.mapColumn.hasNumberFormatting &&
            !this.mapConfig.tooltipUseCustomLabels
        )
    }

    private formatAnnotationLabel(value: string | number): string {
        return this.manager.mapColumn.formatValueShortWithAbbreviations(value)
    }

    @computed private get annotationCandidateFeatures(): GlobeRenderFeature[] {
        if (!this.shouldShowAnnotations) return []

        return excludeUndefined(
            this.mapConfig.selection.selectedCountryNamesInForeground.map(
                (name) => this.featuresById.get(name)
            )
        )
    }

    /* Naively placed annotations that might be overlapping */
    @computed
    private get annotationCandidates(): Annotation[] {
        return excludeUndefined(
            this.annotationCandidateFeatures
                .filter(
                    (feature): feature is GlobeRenderFeature =>
                        feature !== undefined &&
                        // don't show annotations for countries that are currently
                        // on the back side of the globe or at the edge
                        this.isFeatureCentroidVisibleOnGlobe(feature, 0.3)
                )
                .map((feature) => {
                    const series = this.choroplethData.get(feature.id)
                    if (!series) return

                    const labelColor = isDarkColor(series.color)
                        ? ANNOTATION_COLOR_LIGHT
                        : ANNOTATION_COLOR_DARK
                    const fontSizeScale = 1 / this.zoomScale

                    const args = {
                        feature,
                        projection: this.projection,
                        formattedValue: this.formatAnnotationLabel(
                            series.value
                        ),
                        color: labelColor,
                    }

                    // try to fit the annotation inside the feature
                    const internalAnnotation =
                        makeInternalAnnotationForFeature(args)
                    if (internalAnnotation) return internalAnnotation

                    // place the annotation outside of the feature
                    const externalAnnotation = makeExternalAnnotationForFeature(
                        { ...args, fontSizeScale }
                    )
                    if (externalAnnotation) return externalAnnotation

                    return undefined
                })
        )
    }

    @computed
    private get internalAnnotations(): InternalAnnotation[] {
        return this.annotationCandidates.filter(
            (annotation) => annotation.type === "internal"
        )
    }

    @computed
    private get externalAnnotations(): ExternalAnnotation[] {
        const { projection, backgroundFeatureIdSet } = this
        const annotations = this.annotationCandidates.filter(
            (annotation) => annotation.type === "external"
        )
        return repositionAndFilterExternalAnnotations({
            annotations,
            projection,
            backgroundFeatureIdSet,
        })
    }

    private rotateFrameId: number | undefined
    @action.bound private rotateGlobe(targetCoords: [number, number]): void {
        if (this.rotateFrameId) cancelAnimationFrame(this.rotateFrameId)
        this.rotateFrameId = requestAnimationFrame(() => {
            this.mapConfig.globe.rotation = [
                -targetCoords[0],
                // Clamping the latitude to [-90, 90] would allow rotation up to the poles.
                // However, the panning strategy used doesn't work well around the poles.
                // That's why we clamp the latitude to a narrower range.
                -R.clamp(targetCoords[1], {
                    min: GLOBE_LATITUDE_MIN,
                    max: GLOBE_LATITUDE_MAX,
                }),
            ]
        })
    }

    private zoomFrameId: number | undefined
    @action.bound private zoomGlobe(delta: number): void {
        if (this.zoomFrameId) cancelAnimationFrame(this.zoomFrameId)
        this.zoomFrameId = requestAnimationFrame(() => {
            const sensitivity = 0.01
            const newZoom = this.zoomScale * (1 + delta * sensitivity)
            this.mapConfig.globe.zoom = R.clamp(newZoom, {
                min: GLOBE_MIN_ZOOM,
                max: GLOBE_MAX_ZOOM,
            })
        })
    }

    @computed private get hoverFeature(): GlobeRenderFeature | undefined {
        return this.hoverEnterFeature || this.hoverNearbyFeature
    }

    @action.bound private clearHover(): void {
        this.hoverEnterFeature = undefined
        this.hoverNearbyFeature = undefined
        this.manager.onMapMouseLeave?.()
        this.globeController.dismissCountryFocus()
    }

    @action.bound private onMouseMove(event: MouseEvent): void {
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
        // Fixes an issue where clicking on a country that overlaps with the
        // tooltip causes the tooltip to disappear shortly after being rendered
        if (this.isTouchDevice) return

        this.clearHoverEnterFeature()
    }

    @action.bound private setHoverEnterFeature(
        feature: GlobeRenderFeature
    ): void {
        if (this.hoverEnterFeature?.id === feature.id) return

        this.hoverEnterFeature = feature
        this.manager.onMapMouseOver?.(feature.geo)
    }

    @action.bound private clearHoverEnterFeature(): void {
        this.hoverEnterFeature = undefined
        this.manager.onMapMouseLeave?.()
    }

    @action.bound private onClick(feature: GlobeRenderFeature): void {
        this.setHoverEnterFeature(feature)

        // reset the region if necessary
        this.mapConfig.region = MapRegionName.World

        // select/deselect the country if allowed
        const country = feature.id
        if (this.manager.isMapSelectionEnabled) {
            this.mapConfig.selection.toggleSelection(country)

            // reset the map region dropdown if the selection changed
            if (this.manager.mapRegionDropdownValue === "Selection")
                this.manager.resetMapRegionDropdownValue?.()

            // make sure country focus is dismissed for unselected countries
            if (!this.mapConfig.selection.selectedSet.has(country))
                this.globeController.dismissCountryFocus()
        }

        // rotate to the selected country on mobile
        if (!this.manager.isMapSelectionEnabled) {
            // only zoom in on click, never zoom out
            const zoom = Math.max(GLOBE_COUNTRY_ZOOM, this.mapConfig.globe.zoom)
            this.globeController.rotateToCountry(country, zoom)
        }
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

        // Possible interaction types are
        // - zoom-scroll: zooming by scrolling via the wheel event
        // - zoom-pinch: zooming by pinching using two fingers on touch devices
        // - pan: panning by dragging the mouse or using a finger on touch devices
        type InteractionType = "zoom-scroll" | "zoom-pinch" | "pan"

        // Panning and zooming are powered by D3.
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
                startRot: [number, number, number],
                previousPos: [number, number]

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
                    const posVector = getRelativeMouse(base, event.sourceEvent)
                    const pos: [number, number] = [posVector.x, posVector.y]

                    startCoords = versor.cartesian(this.projection.invert(pos))
                    startRot = this.projection.rotate()
                    startQuat = versor(startRot)
                    previousPos = pos
                }

                if (type === "zoom-pinch") startPinching()
                else if (type === "pan") startPanning()

                previousType = type
            }

            const panningOrZooming = (event: any): void => {
                this.isPanningOrZooming = true

                this.clearHover() // dismiss the tooltip
                this.mapConfig.region = MapRegionName.World // reset region
                this.manager.resetMapRegionDropdownValue?.() // reset map region dropdown

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
                    const posVector = getRelativeMouse(base, event.sourceEvent)
                    const pos: [number, number] = [posVector.x, posVector.y]

                    // True if the cursor is currently over the globe
                    const isDraggingGlobe = isPointInCircle(posVector, {
                        cx: this.globeCenter[0],
                        cy: this.globeCenter[1],
                        r: this.globeRadius,
                    })

                    if (isDraggingGlobe) {
                        // If the user is dragging the globe, then use a
                        // rotation strategy that ensures the geographic start
                        // point remains under the cursor where possible

                        const currCoords = versor.cartesian(
                            this.projection.rotate(startRot).invert(pos)
                        )
                        const delta = versor.delta(startCoords, currCoords)
                        const quat = versor.multiply(startQuat, delta)
                        const rotation = versor.rotation(quat)

                        // Ignore the gamma channel for more intuitive rotation
                        // see https://observablehq.com/@d3/three-axis-rotation
                        // for a visual explanation of three-axis rotation.
                        // As a side effect, rotation around the poles feels off.
                        this.rotateGlobe([rotation[0], rotation[1]])
                    } else {
                        // If the user's cursor is outside of the globe, then
                        // adjust the globe's rotation based on the cursor's
                        // movement, applying a sensitivity factor to control
                        // the speed of rotation

                        const sensitivity = 0.8
                        const r = this.globeRotation
                        const dx = pos[0] - previousPos[0]
                        const dy = pos[1] - previousPos[1]
                        this.rotateGlobe([
                            r[0] + sensitivity * dx,
                            r[1] - sensitivity * dy,
                        ])
                    }

                    previousPos = pos
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
                .scaleExtent([this.minScale, this.maxScale])
                .touchable(() => this.isTouchDevice)
                .on("start", panningOrZoomingStart)
                .on("zoom", panningOrZooming)
                .on("end", panningOrZoomingEnd)
        }

        select(base).call(panAndZoom())
    }

    override componentDidMount(): void {
        // rotate to the selected region
        if (isValidGlobeRegionName(this.mapConfig.region)) {
            this.globeController.jumpToOwidContinent(this.mapConfig.region)
        }

        document.addEventListener("touchstart", this.onDocumentClick, {
            capture: true,
            passive: true,
        })

        this.setUpPanningAndZooming()
    }

    override componentWillUnmount(): void {
        document.removeEventListener("touchstart", this.onDocumentClick, {
            capture: true,
        })

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
                    r={this.globeRadius}
                    fill="#fafafa"
                />
                <path
                    id={makeIdForHumanConsumption("globe-graticule")}
                    d={this.graticulePath}
                    stroke="#e7e7e7"
                    strokeWidth={1}
                    fill="none"
                    style={{ pointerEvents: "none" }}
                />
                <path
                    id={makeIdForHumanConsumption("globe-equator")}
                    d={this.equatorPath}
                    stroke="#dadada"
                    strokeWidth={1}
                    fill="none"
                    style={{ pointerEvents: "none" }}
                />
            </>
        )
    }

    renderFeaturesInBackground(): React.ReactElement | undefined {
        if (this.backgroundFeatures.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("countries-background")}>
                {this.backgroundFeatures.map((feature) => (
                    <BackgroundCountry
                        key={feature.id}
                        feature={feature}
                        path={this.getPath(feature)}
                    />
                ))}
            </g>
        )
    }

    renderFeaturesWithNoData(): React.ReactElement | undefined {
        if (this.featuresWithNoData.length === 0) return

        const patternId = Patterns.noDataPatternForGlobe

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
                        isSelected={this.manager.isSelected?.(feature.id)}
                        hover={this.manager.getHoverState?.(feature.id)}
                        onClick={(event) => {
                            // don't invoke a second click on parent that
                            // catches clicks on 'nearby' features
                            event.stopPropagation()

                            this.onClick(feature)
                        }}
                        onTouchStart={() => this.onTouchStart(feature)}
                        onMouseEnter={this.onMouseEnterFeature}
                        onMouseLeave={this.onMouseLeaveFeature}
                    />
                ))}
            </g>
        )
    }

    renderFeaturesWithData(): React.ReactElement | undefined {
        if (this.sortedFeaturesWithData.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("countries-with-data")}>
                {this.manager.hasProjectedData && (
                    <defs>
                        {/* Pattern used by the map legend for the projected data bin */}
                        <ProjectedDataPattern
                            key={PROJECTED_DATA_LEGEND_COLOR}
                            color={PROJECTED_DATA_LEGEND_COLOR}
                            forLegend
                        />

                        {/* Patterns used by the map legend. These duplicate the patterns below,
                            but use a legend-specific id */}
                        {this.binColors.map((color, index) => (
                            <ProjectedDataPattern
                                key={`${color}-${index}`}
                                color={color}
                                forLegend
                            />
                        ))}

                        {/* Pattern used by features */}
                        {this.binColors.map((color, index) => (
                            <ProjectedDataPattern
                                key={`${color}-${index}`}
                                color={color}
                            />
                        ))}
                    </defs>
                )}

                {this.sortedFeaturesWithData.map((feature) => {
                    const series = this.choroplethData.get(feature.id)
                    if (!series) return null
                    return (
                        <CountryWithData
                            key={feature.id}
                            feature={feature}
                            series={series}
                            path={this.getPath(feature)}
                            isSelected={this.manager.isSelected?.(feature.id)}
                            hover={this.manager.getHoverState?.(feature.id)}
                            onClick={(event) => {
                                // don't invoke a second click on parent that
                                // catches clicks on 'nearby' features
                                event.stopPropagation()

                                this.onClick(feature)
                            }}
                            onTouchStart={() => this.onTouchStart(feature)}
                            onMouseEnter={this.onMouseEnterFeature}
                            onMouseLeave={this.onMouseLeaveFeature}
                        />
                    )
                })}
            </g>
        )
    }

    renderInternalAnnotations(): React.ReactElement | undefined {
        if (this.internalAnnotations.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("annotations-internal")}>
                {this.internalAnnotations.map((annotation) => (
                    <InternalValueAnnotation
                        key={annotation.id}
                        annotation={annotation}
                        showOutline={
                            this.choroplethData.get(annotation.id)?.isProjection
                        }
                    />
                ))}
            </g>
        )
    }

    renderExternalAnnotations(): React.ReactElement | undefined {
        if (this.externalAnnotations.length === 0) return

        return (
            <g
                id={makeIdForHumanConsumption("annotations-external")}
                className="ExternalAnnotations"
            >
                {this.externalAnnotations.map((annotation) => (
                    <ExternalValueAnnotation
                        key={annotation.id}
                        annotation={annotation}
                        onMouseEnter={action((feature: RenderFeature) =>
                            this.setHoverEnterFeature(
                                feature as GlobeRenderFeature
                            )
                        )}
                        onMouseLeave={action(() =>
                            this.clearHoverEnterFeature()
                        )}
                    />
                ))}
            </g>
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderGlobeOutline()}
                <g id={makeIdForHumanConsumption("globe")}>
                    {this.renderFeaturesInBackground()}
                    {this.renderFeaturesWithNoData()}
                    {this.renderFeaturesWithData()}
                    {this.renderInternalAnnotations()}
                    {this.renderExternalAnnotations()}
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
                onClick={() => {
                    // invoke a click on a feature when clicking nearby one
                    if (this.hoverNearbyFeature)
                        this.onClick(this.hoverNearbyFeature)
                }}
                style={{ cursor: this.hoverFeature ? "pointer" : undefined }}
            >
                {this.renderGlobeOutline()}
                <g className={GEO_FEATURES_CLASSNAME}>
                    {this.renderFeaturesInBackground()}
                    {this.renderFeaturesWithNoData()}
                    {this.renderFeaturesWithData()}
                    {this.renderInternalAnnotations()}
                    {this.renderExternalAnnotations()}
                </g>
            </g>
        )
    }

    override render(): React.ReactElement {
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

function isPointInCircle(
    point: PointVector,
    circle: { cx: number; cy: number; r: number }
): boolean {
    const { x, y } = point
    const { cx, cy, r } = circle

    const distanceSquared = (x - cx) ** 2 + (y - cy) ** 2
    const radiusSquared = r ** 2

    return distanceSquared <= radiusSquared
}
