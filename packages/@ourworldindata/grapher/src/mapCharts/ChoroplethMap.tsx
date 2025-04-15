import React from "react"
import {
    Bounds,
    difference,
    isTouchDevice,
    makeIdForHumanConsumption,
    excludeUndefined,
} from "@ourworldindata/utils"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { Quadtree, quadtree } from "d3-quadtree"
import {
    MapRenderFeature,
    SVGMouseEvent,
    GEO_FEATURES_CLASSNAME,
    ChoroplethMapManager,
    ChoroplethSeriesByName,
    CHOROPLETH_MAP_CLASSNAME,
    ExternalAnnotation,
    InternalAnnotation,
    ANNOTATION_FONT_SIZE_DEFAULT,
    Annotation,
    DEFAULT_STROKE_WIDTH,
    Direction,
    ANNOTATION_FONT_SIZE_MIN,
    ANNOTATION_MARKER_LINE_LENGTH_DEFAULT,
} from "./MapChartConstants"
import { getGeoFeaturesForMap } from "./GeoFeatures"
import {
    BackgroundCountry,
    CountryWithData,
    CountryWithNoData,
    NoDataPattern,
} from "./MapComponents"
import { Patterns } from "../core/GrapherConstants"
import {
    checkAnnotationCollidesWithLandmass,
    checkAnnotationMarkerCollidesWithLabel,
    detectNearbyFeature,
    getExternalMarkerEndPosition,
    getForegroundFeatures,
    getNearbyFeatures,
    makeEllipseForProjection,
    minimiseLabelCollisions,
    placeLabelAtEllipseCenter,
    extendMarkerLineToBridgeGivenFeatures,
    placeLabelExternally,
    sortFeaturesByInteractionState,
} from "./MapHelpers"
import { annotationPlacementsById } from "./MapAnnotationPlacements"
import { geoRobinson } from "./d3-geo-projection"
import { geoContains } from "d3"
import { isDarkColor } from "../color/ColorUtils"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"

@observer
export class ChoroplethMap extends React.Component<{
    manager: ChoroplethMapManager
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable private hoverEnterFeature?: MapRenderFeature
    @observable private hoverNearbyFeature?: MapRenderFeature

    @computed private get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    private viewport = { x: 0.565, y: 0.5 } as const

    @computed private get manager(): ChoroplethMapManager {
        return this.props.manager
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
        const allBounds = this.features.map((feature) => feature.projBounds)
        return Bounds.merge(allBounds)
    }

    // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
    @computed private get viewportScale(): number {
        const { bounds, mapBounds } = this
        return Math.min(
            bounds.width / mapBounds.width,
            bounds.height / mapBounds.height
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

    @computed private get features(): MapRenderFeature[] {
        return getGeoFeaturesForMap()
    }

    @computed private get featuresById(): Map<string, MapRenderFeature> {
        return new Map(this.features.map((feature) => [feature.id, feature]))
    }

    @computed private get foregroundFeatures(): MapRenderFeature[] {
        return getForegroundFeatures(this.features, this.manager.selectionArray)
    }

    @computed
    private get backgroundFeatures(): MapRenderFeature[] {
        return difference(this.features, this.foregroundFeatures)
    }

    @computed private get featuresWithData(): MapRenderFeature[] {
        return this.foregroundFeatures.filter((feature) =>
            this.choroplethData.has(feature.id)
        )
    }

    @computed private get sortedFeaturesWithData(): MapRenderFeature[] {
        // sort features so that hovered or selected features are rendered last
        return sortFeaturesByInteractionState(this.featuresWithData, {
            isHovered: (featureId: string) =>
                this.manager.getHoverState(featureId).active,
            isSelected: (featureId) => this.manager.isSelected(featureId),
        })
    }

    @computed private get featuresWithNoData(): MapRenderFeature[] {
        return difference(this.foregroundFeatures, this.featuresWithData)
    }

    @computed private get quadtree(): Quadtree<MapRenderFeature> {
        return quadtree<MapRenderFeature>()
            .x((feature) => feature.projBounds.centerX)
            .y((feature) => feature.projBounds.centerY)
            .addAll(this.foregroundFeatures)
    }

    @computed private get projection(): any {
        return geoRobinson()
    }

    @computed private get shouldShowAnnotations(): boolean {
        return this.manager.shouldShowEntitySelectorOnMapTab ?? false
    }

    private formatAnnotationLabel(value: string | number): string {
        return this.manager.mapColumn.formatValueShortWithAbbreviations(value)
    }

    private makeInternalAnnotationForFeature(
        feature: MapRenderFeature
    ): InternalAnnotation<MapRenderFeature> | undefined {
        const { projection } = this

        const series = this.choroplethData.get(feature.id)
        const placement = annotationPlacementsById.get(feature.id)
        if (!series || !placement || !placement.ellipse) return

        // project ellipse onto the globe
        const ellipse = makeEllipseForProjection({
            ellipse: placement.ellipse,
            projection,
        })

        if (!ellipse) return

        const formattedValue = this.formatAnnotationLabel(series.value)
        let { placedBounds, fontSize } =
            placeLabelAtEllipseCenter({
                text: formattedValue,
                ellipse,
                fontSizeScale: this.viewportScaleSqrt,
            }) ?? {}

        const color = isDarkColor(series.color) ? "#fff" : GRAPHER_DARK_TEXT

        if (placedBounds && fontSize)
            return {
                type: "internal",
                id: feature.id,
                feature,
                placedBounds,
                text: formattedValue,
                ellipse: ellipse,
                fontSize: fontSize,
                color,
            }

        return
    }

    private makeExternalAnnotationForFeature(
        feature: MapRenderFeature
    ): ExternalAnnotation<MapRenderFeature> | undefined {
        const { projection } = this

        const series = this.choroplethData.get(feature.id)
        const placement = annotationPlacementsById.get(feature.id)
        const external = placement?.external
        if (!series || !placement || !external) return

        const { direction } = external

        const anchorPoint = this.projection(external.anchorPoint)

        const fontSize = ANNOTATION_FONT_SIZE_MIN / this.viewportScaleSqrt
        const markerLength =
            ANNOTATION_MARKER_LINE_LENGTH_DEFAULT / this.viewportScaleSqrt

        const formattedValue = this.formatAnnotationLabel(series.value)
        const textBounds = Bounds.forText(formattedValue, {
            fontSize,
        }).set({ height: fontSize - 1 }) // todo: small correction
        const labelPosition = placeLabelExternally({
            anchorPoint,
            textBounds,
            direction,
            markerLength,
        })

        // place label at the given center position
        let placedBounds = textBounds.set({
            x: labelPosition[0],
            y: labelPosition[1],
        })

        // make sure the external label doesn't overlap with bridge countries (including itself)
        const bridgeCountries = [
            feature.id,
            ...(external.bridgeCountries ?? []),
        ]
        const bridgeFeatures = excludeUndefined(
            bridgeCountries.map((country) => this.featuresById.get(country))
        )
        placedBounds = extendMarkerLineToBridgeGivenFeatures({
            bridgeFeatures,
            placedBounds,
            direction,
            projection,
            step: 1.5 * markerLength,
        })

        return {
            type: "external",
            id: feature.id,
            feature,
            text: formattedValue,
            placedBounds,
            anchor: anchorPoint,
            direction,
            fontSize,
            color: GRAPHER_DARK_TEXT,
        }
    }

    private showAllAnnotations = true

    /* Naively placed annotations that might be overlapping */
    @computed
    private get initialAnnotations(): Annotation<MapRenderFeature>[] {
        if (!this.shouldShowAnnotations) return []

        const features = this.showAllAnnotations
            ? this.featuresWithData
            : this.manager.mapConfig.selection.selectedEntityNames
                  .map((name) => this.featuresById.get(name))
                  .filter((feature) => feature !== undefined)

        return excludeUndefined(
            features.map((feature) => {
                // try to fit the annotation inside the feature
                const internalAnnotation =
                    this.makeInternalAnnotationForFeature(feature)
                if (internalAnnotation) return internalAnnotation

                // place the annotation outside of the feature
                const externalAnnotation =
                    this.makeExternalAnnotationForFeature(feature)
                if (externalAnnotation) return externalAnnotation

                return undefined
            })
        )
    }

    @computed
    private get internalAnnotations(): InternalAnnotation<MapRenderFeature>[] {
        return this.initialAnnotations.filter(
            (annotation) => annotation.type === "internal"
        )
    }

    @computed
    private get externalAnnotations(): ExternalAnnotation<MapRenderFeature>[] {
        const { projection } = this

        const initialAnnotations = this.initialAnnotations.filter(
            (annotation) => annotation.type === "external"
        )
        const initialAnnotationsById = new Map(
            initialAnnotations.map((a) => [a.id, a])
        )

        const nonOverlappingAnnotations =
            minimiseLabelCollisions(initialAnnotations)

        const filteredAnnotations = nonOverlappingAnnotations.filter(
            (annotation) => {
                const nearbyFeatures = getNearbyFeatures({
                    feature: annotation.feature,
                    allFeatures: this.features,
                })
                const nearbyAnnotations = excludeUndefined(
                    nearbyFeatures.map((feature) =>
                        initialAnnotationsById.get(feature.id)
                    )
                )
                return (
                    !checkAnnotationMarkerCollidesWithLabel({
                        annotation,
                        nearbyAnnotations,
                    }) &&
                    !checkAnnotationCollidesWithLandmass({
                        annotation,
                        nearbyFeatures,
                        projection,
                    })
                )
            }
        )

        const filteredAnnotationsAtOriginalPositions = filteredAnnotations.map(
            (annotation) => {
                const origBounds = initialAnnotationsById.get(
                    annotation.id
                )!.placedBounds
                return { ...annotation, placedBounds: origBounds }
            }
        )

        const placedAnnotations = minimiseLabelCollisions(
            filteredAnnotationsAtOriginalPositions
        )

        return placedAnnotations
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

    @action.bound private onClick(feature: MapRenderFeature): void {
        const {
            shouldEnableEntitySelectionOnMapTab,
            shouldShowEntitySelectorOnMapTab,
            mapConfig: { selection },
            globeController,
        } = this.manager

        this.setHoverEnterFeature(feature)

        // select/deselect the country if allowed
        if (shouldEnableEntitySelectionOnMapTab) {
            selection.toggleSelection(feature.id)
        }

        // TODO: re-enable
        // if (
        //     selection.selectedSet.has(feature.id) &&
        //     shouldShowEntitySelectorOnMapTab
        // ) {
        //     globeController?.rotateToCountry(feature.id)
        // }

        // rotate to the selected country on the globe on mobile
        if (!shouldShowEntitySelectorOnMapTab) {
            globeController?.focusOnCountry(feature.id)
        }
    }

    @action.bound private onDocumentClick(): void {
        if (this.hoverEnterFeature || this.hoverNearbyFeature) {
            this.hoverEnterFeature = undefined
            this.hoverNearbyFeature = undefined
            this.manager.onMapMouseLeave()
        }
    }

    renderAnnotations(): React.ReactElement | void {
        if (this.initialAnnotations.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("annotations")}>
                {this.internalAnnotations.map((annotation) => {
                    const { id, text, color, placedBounds, fontSize } =
                        annotation

                    return (
                        <g
                            key={id}
                            id={makeIdForHumanConsumption(id)}
                            style={{ pointerEvents: "none" }}
                        >
                            {/* <ellipse
                                cx={ellipse.cx}
                                cy={ellipse.cy}
                                rx={ellipse.rx}
                                ry={ellipse.ry}
                                fill="gold"
                                fillOpacity={0.4}
                            />
                            <rect
                                {...bounds.toProps()}
                                fill="none"
                                stroke="black"
                            /> */}
                            <text
                                x={placedBounds.topLeft.x}
                                y={placedBounds.topLeft.y}
                                // TODO: shouldn't use dominant-baseline
                                dominantBaseline="hanging"
                                // dy={dyFromAlign(VerticalAlign.bottom)}
                                fontSize={fontSize}
                                strokeWidth={
                                    DEFAULT_STROKE_WIDTH /
                                    this.viewportScaleSqrt
                                }
                                fill={color}
                            >
                                {text}
                            </text>
                        </g>
                    )
                })}
                {this.externalAnnotations.map((annotation) => {
                    const {
                        id,
                        text,
                        direction,
                        anchor,
                        placedBounds,
                        fontSize,
                    } = annotation

                    const markerStart = anchor
                    const markerEnd = getExternalMarkerEndPosition({
                        textBounds: placedBounds,
                        direction,
                    })

                    return (
                        <g
                            key={id}
                            id={makeIdForHumanConsumption(id)}
                            style={{ pointerEvents: "none" }}
                        >
                            <line
                                x1={markerStart[0]}
                                y1={markerStart[1]}
                                x2={markerEnd[0]}
                                y2={markerEnd[1]}
                                stroke={annotation.color}
                                strokeWidth={
                                    (DEFAULT_STROKE_WIDTH * 1.5) /
                                    this.viewportScaleSqrt
                                }
                            />
                            {/* <rect
                                {...placedBounds.toProps()}
                                fill="none"
                                stroke="black"
                            /> */}
                            <text
                                x={placedBounds.x}
                                y={placedBounds.y + placedBounds.height - 1}
                                fontSize={fontSize}
                                strokeWidth={
                                    DEFAULT_STROKE_WIDTH /
                                    this.viewportScaleSqrt
                                }
                                fill={annotation.color}
                            >
                                {text}
                            </text>
                        </g>
                    )
                })}
            </g>
        )
    }

    renderFeaturesInBackground(): React.ReactElement | void {
        if (this.backgroundFeatures.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("countries-background")}>
                {this.backgroundFeatures.map((feature) => (
                    <BackgroundCountry key={feature.id} feature={feature} />
                ))}
            </g>
        )
    }

    renderFeaturesWithoutData(): React.ReactElement | void {
        if (this.featuresWithNoData.length === 0) return
        const patternId = Patterns.noDataPatternForMap

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
                        isSelected={this.manager.isSelected(feature.id)}
                        hover={this.manager.getHoverState(feature.id)}
                        strokeScale={this.viewportScaleSqrt}
                        onClick={() => this.onClick(feature)}
                        onTouchStart={() => this.onTouchStart(feature)}
                        onMouseEnter={this.onMouseEnter}
                        onMouseLeave={this.onMouseLeave}
                    />
                ))}
            </g>
        )
    }

    renderFeaturesWithData(): React.ReactElement | void {
        if (this.sortedFeaturesWithData.length === 0) return

        return (
            <g id={makeIdForHumanConsumption("countries-with-data")}>
                {this.sortedFeaturesWithData.map((feature) => {
                    const series = this.choroplethData.get(feature.id)
                    if (!series) return null
                    return (
                        <CountryWithData
                            key={feature.id}
                            feature={feature}
                            series={series}
                            isSelected={this.manager.isSelected(feature.id)}
                            hover={this.manager.getHoverState(feature.id)}
                            strokeScale={this.viewportScaleSqrt}
                            onClick={() => this.onClick(feature)}
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
                {this.renderFeaturesInBackground()}
                {this.renderFeaturesWithoutData()}
                {this.renderFeaturesWithData()}
                {this.renderAnnotations()}
            </g>
        )
    }

    componentDidMount(): void {
        document.addEventListener("touchstart", this.onDocumentClick, {
            capture: true,
            passive: true,
        })
    }

    componentWillUnmount(): void {
        document.removeEventListener("touchstart", this.onDocumentClick, {
            capture: true,
        })
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
                    {this.renderFeaturesInBackground()}
                    {this.renderFeaturesWithoutData()}
                    {this.renderFeaturesWithData()}
                    {this.renderAnnotations()}
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
