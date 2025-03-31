import { geoInterpolate } from "d3-geo"
import { interpolateNumber } from "d3-interpolate"
import { easeCubicOut } from "d3-ease"
import { EntityName, MapRegionName } from "@ourworldindata/types"
import { delay } from "@ourworldindata/utils"
import { GlobeConfig, MapConfig } from "./MapConfig"
import { getFeaturesForGlobe } from "./GeoFeatures"
import { DEFAULT_VIEWPORT, MAP_VIEWPORTS } from "./MapChartConstants"

const geoFeaturesById = new Map(getFeaturesForGlobe().map((f) => [f.id, f]))

interface GlobeControllerManager {
    mapConfig: MapConfig
}

export class GlobeController {
    private manager: GlobeControllerManager

    private tickStep = 0.1
    private msPerTick = 60

    constructor(manager: GlobeControllerManager) {
        this.manager = manager
    }

    private get globeConfig(): GlobeConfig {
        return this.manager.mapConfig.globe
    }

    toggleGlobe(): void {
        this.globeConfig.isActive = !this.globeConfig.isActive

        // reset globe if it's being hidden
        if (!this.globeConfig.isActive) this.resetGlobe()
    }

    private resetGlobe(): void {
        this.globeConfig.rotation = DEFAULT_VIEWPORT.rotation
        this.globeConfig.zoom = 1
        this.globeConfig.focusCountry = undefined
    }

    showGlobe(): void {
        this.globeConfig.isActive = true
    }

    jumpTo({
        coords,
        zoom,
    }: {
        coords?: [number, number]
        zoom?: number
    }): void {
        if (coords) this.globeConfig.rotation = coords
        if (zoom) this.globeConfig.zoom = zoom
    }

    focusOnCountry(country: EntityName): void {
        this.globeConfig.focusCountry = country
    }

    dismissCountryFocus(): void {
        this.globeConfig.focusCountry = undefined
    }

    jumpToCountryOffset(country: EntityName, zoom?: number): void {
        const geoFeature = geoFeaturesById.get(country)
        if (!geoFeature) return

        const { centroid } = geoFeature
        const targetCoords: [number, number] = [
            -centroid[0] + 40, // offset by an arbitrary amount
            -centroid[1],
        ]

        this.jumpTo({ coords: targetCoords, zoom })
    }

    rotateToCountry(country: EntityName, zoom?: number): void {
        const geoFeature = geoFeaturesById.get(country)
        if (!geoFeature) return

        const { centroid } = geoFeature
        const targetCoords: [number, number] = [-centroid[0], -centroid[1]]

        void this.rotateTo(targetCoords, zoom)
    }

    jumpToRegion(region: MapRegionName): void {
        const viewport = MAP_VIEWPORTS[region]

        const targetCoords = viewport.rotation
        const targetZoom = viewport.zoom

        this.jumpTo({ coords: targetCoords, zoom: targetZoom })
    }

    private currentAnimation?: AbortController
    private async rotateTo(
        coords: [number, number],
        zoom?: number
    ): Promise<void> {
        // cancel any ongoing rotation
        if (this.currentAnimation) {
            this.currentAnimation.abort()
            this.currentAnimation = undefined
        }

        // set up a new abort controller
        const controller = new AbortController()
        this.currentAnimation = controller

        try {
            await this._rotateTo(controller.signal, coords, zoom)
        } catch {
            // aborted
        } finally {
            if (this.currentAnimation === controller) {
                this.currentAnimation = undefined
            }
        }
    }

    private async _rotateTo(
        signal: AbortSignal,
        targetCoords: [number, number],
        targetZoom?: number
    ): Promise<void> {
        const currentCoords = this.globeConfig.rotation
        const animatedCoords = geoInterpolate(currentCoords, targetCoords)

        const currentZoom = this.globeConfig.zoom
        const animatedZoom =
            targetZoom !== undefined
                ? interpolateNumber(currentZoom, targetZoom)
                : undefined

        for (let t = this.tickStep; t <= 1; t += this.tickStep) {
            // Check if the animation was canceled
            if (signal.aborted) return

            // animate globe rotation
            this.globeConfig.rotation = animatedCoords(easeCubicOut(t))

            // animate zoom
            if (animatedZoom)
                this.globeConfig.zoom = animatedZoom(easeCubicOut(t))

            await delay(this.msPerTick)
        }

        // ensure we end exactly at the target values
        this.globeConfig.rotation = targetCoords
        if (targetZoom !== undefined) this.globeConfig.zoom = targetZoom
    }
}
