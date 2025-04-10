import { geoInterpolate } from "d3-geo"
import { interpolateNumber } from "d3-interpolate"
import { easeCubicOut } from "d3-ease"
import { EntityName, GlobeRegionName } from "@ourworldindata/types"
import { GlobeConfig, MapConfig } from "./MapConfig"
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

    showGlobe(): void {
        this.globeConfig.isActive = true
    }

    hideGlobe(): void {
        this.globeConfig.isActive = false
        this.resetGlobe()
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

    showGlobeAndRotateToCountry(country: EntityName): void {
        // switch to the globe view first. before switching to the globe,
        // jump to the country's offset position so that rotating to it
        // is predictable
        this.jumpToCountryOffset(country)
        this.showGlobe()

        // then rotate to the country
        this.rotateToCountry(country, GLOBE_COUNTRY_ZOOM)
    }

    /** Highlights a country on the globe and rotates to it */
    focusOnCountry(country: EntityName): void {
        if (this.globeConfig.isActive) {
            // if we're on the globe view, highlight the country and rotate to it
            this.setFocusCountry(country)
            this.rotateToCountry(country)
        } else {
            this.setFocusCountry(country)
            this.showGlobeAndRotateToCountry(country)
        }
    }

    setFocusCountry(country: EntityName): void {
        this.globeConfig.focusCountry = country
    }

    dismissCountryFocus(): void {
        this.globeConfig.focusCountry = undefined
    }

    jumpToCountry(country: EntityName, zoom?: number): void {
        const geoFeature = geoFeaturesById.get(country)
        if (!geoFeature) return

        const { centroid } = geoFeature
        const targetCoords: [number, number] = [-centroid[0], -centroid[1]]

        this.jumpTo({ coords: targetCoords, zoom })
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

    jumpToRegion(region: GlobeRegionName): void {
        const viewport = GLOBE_VIEWPORTS[region]

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
