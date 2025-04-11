import { geoInterpolate } from "d3-geo"
import { interpolateNumber } from "d3-interpolate"
import { easeCubicOut } from "d3-ease"
import { EntityName, GlobeConfig, GlobeRegionName } from "@ourworldindata/types"
import { MapConfig } from "./MapConfig"
import { getGeoFeaturesForGlobe } from "./GeoFeatures"
import {
    DEFAULT_GLOBE_ROTATION,
    GLOBE_COUNTRY_ZOOM,
    GLOBE_VIEWPORTS,
} from "./MapChartConstants"

const geoFeaturesById = new Map(getGeoFeaturesForGlobe().map((f) => [f.id, f]))

interface GlobeControllerManager {
    mapConfig: MapConfig
}

export class GlobeController {
    private manager: GlobeControllerManager

    private animDuration = 600

    constructor(manager: GlobeControllerManager) {
        this.manager = manager
    }

    private get globeConfig(): GlobeConfig {
        return this.manager.mapConfig.globe
    }

    showGlobe(): void {
        this.globeConfig.isActive = true
    }

    hideGlobe(): void {
        this.globeConfig.isActive = false
        this.resetGlobe()
    }

    toggleGlobe(): void {
        this.globeConfig.isActive = !this.globeConfig.isActive

        // reset globe if it's being hidden
        if (!this.globeConfig.isActive) this.resetGlobe()
    }

    private resetGlobe(): void {
        this.globeConfig.rotation = DEFAULT_GLOBE_ROTATION
        this.globeConfig.zoom = 1
        this.globeConfig.focusCountry = undefined
    }

    private setFocusCountry(country: EntityName): void {
        this.globeConfig.focusCountry = country
    }

    dismissCountryFocus(): void {
        this.globeConfig.focusCountry = undefined
    }

    private jumpTo({
        coords,
        zoom,
        xOffset = 0,
    }: {
        coords?: [number, number]
        zoom?: number
        xOffset?: number // optionally offset the x coordinate
    }): void {
        if (coords) this.globeConfig.rotation = [coords[0] + xOffset, coords[1]]
        if (zoom) this.globeConfig.zoom = zoom
    }

    focusOnCountry(country: EntityName): void {
        this.rotateToCountry(country)
        this.setFocusCountry(country)
    }

    rotateToCountry(country: EntityName): void {
        // jump to the country's offset position before switching to
        // the globe so that rotating to it is predictable
        if (!this.globeConfig.isActive) {
            this.jumpToCountry(country, 40)
            this.showGlobe()
        }

        this._rotateToCountry(country, GLOBE_COUNTRY_ZOOM)
    }

    rotateToOwidContinent(continent: GlobeRegionName): void {
        // jump to the continents's offset position before switching to
        // the globe so that rotating to it is predictable
        if (!this.globeConfig.isActive) {
            this.jumpToOwidContinent(continent, 40)
            this.showGlobe()
        }

        this._rotateToOwidContinent(continent)
    }

    private getCoordsForCountry(
        country: EntityName
    ): [number, number] | undefined {
        const geoFeature = geoFeaturesById.get(country)
        if (!geoFeature) return undefined

        const { centroid } = geoFeature
        return [-centroid[0], -centroid[1]]
    }

    private getCoordsForOwidContinent(
        continent: GlobeRegionName
    ): [number, number] {
        return GLOBE_VIEWPORTS[continent].rotation
    }

    private getZoomForOwidContinent(continent: GlobeRegionName): number {
        return GLOBE_VIEWPORTS[continent].zoom
    }

    private jumpToCountry(country: EntityName, xOffset = 0): void {
        const coords = this.getCoordsForCountry(country)
        this.jumpTo({ coords, xOffset })
    }

    private _rotateToCountry(country: EntityName, zoom?: number): void {
        const coords = this.getCoordsForCountry(country)
        if (coords) void this.rotateTo(coords, zoom)
    }

    jumpToOwidContinent(continent: GlobeRegionName, xOffset = 0): void {
        const coords = this.getCoordsForOwidContinent(continent)
        const zoom = this.getZoomForOwidContinent(continent)
        this.jumpTo({ coords, zoom, xOffset })
    }

    private _rotateToOwidContinent(continent: GlobeRegionName): void {
        const coords = this.getCoordsForOwidContinent(continent)
        const zoom = this.getZoomForOwidContinent(continent)
        void this.rotateTo(coords, zoom)
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

        const animPromise = new Promise<void>((resolve, reject) => {
            const now = Date.now()
            const step = (): void => {
                const elapsed = Date.now() - now
                const t = Math.min(1, elapsed / this.animDuration)

                // Check if the animation was canceled
                if (signal.aborted) {
                    reject()
                    return
                }

                // animate globe rotation
                this.globeConfig.rotation = animatedCoords(easeCubicOut(t))

                // animate zoom
                if (animatedZoom)
                    this.globeConfig.zoom = animatedZoom(easeCubicOut(t))

                if (t < 1) {
                    requestAnimationFrame(step)
                } else {
                    resolve()
                }
            }
            requestAnimationFrame(step)
        })

        await animPromise
            .catch(() => {
                // ignore
            })
            .then(() => {
                // ensure we end exactly at the target values
                this.globeConfig.rotation = targetCoords
                if (targetZoom !== undefined) this.globeConfig.zoom = targetZoom
            })
    }
}
