import { easeCubicOut } from "d3-ease"
import { geoInterpolate } from "d3-geo"

import { MapProjectionName } from "@ourworldindata/types"
import { delay } from "@ourworldindata/utils"

import { MAP_ZOOM_SCALE, VIEWPORTS } from "./MapChartConstants"
import { MapConfig } from "./MapConfig"
import { centroids, GeoFeatures } from "./MapChart"
import { interpolateNumber } from "d3"

interface GlobeManager {
    mapConfig: MapConfig
}

export class GlobeController {
    private manager: GlobeManager

    private tickStep = 0.1
    private msPerTick = 60

    constructor(manager: GlobeManager) {
        this.manager = manager
    }

    async rotateTo(
        coords: [number, number],
        scale?: number,
        { animate = true } = {}
    ): Promise<void> {
        if (animate) {
            // Cancel any ongoing rotation
            if (this.currentRotateAnimation) {
                this.currentRotateAnimation.abort()
                this.currentRotateAnimation = null
            }

            const controller = new AbortController()
            this.currentRotateAnimation = controller

            try {
                await this.animateRotateTo(controller.signal, coords, scale)
            } catch {
                // aborted
            } finally {
                if (this.currentRotateAnimation === controller) {
                    this.currentRotateAnimation = null
                }
            }
        } else {
            this.manager.mapConfig.globeRotation = coords
            if (scale) this.manager.mapConfig.globeSize = scale
        }
    }

    async rotateToProjection(
        projectionName: MapProjectionName,
        { animate = true } = {}
    ): Promise<void> {
        const viewport = VIEWPORTS[projectionName]
        const targetCoords = viewport.rotation
        const targetScale = viewport.scale

        void this.rotateTo(targetCoords, targetScale, { animate })

        // if (animate) {
        //     void this.animateRotateTo(targetCoords, targetScale)
        // } else {
        //     this.manager.mapConfig.globeRotation = targetCoords
        //     this.manager.mapConfig.globeSize = targetScale
        // }
    }

    async rotateToCountry(
        name: string,
        scale?: number,
        { animate = true } = {}
    ): Promise<void> {
        const featureIndex = GeoFeatures.findIndex(
            (feature) => feature.id === name
        )
        if (featureIndex < 0) return
        const c = centroids()[featureIndex]
        const targetCoords: [number, number] = [-c.x, -c.y]
        // const targetScale = MAP_ZOOM_SCALE
        void this.rotateTo(targetCoords, scale, { animate })
    }

    // Add animation control properties
    private currentZoomAnimation: AbortController | null = null
    // TODO: implement the same for rotate
    private currentRotateAnimation: AbortController | null = null

    async zoomTo(targetScale: number): Promise<void> {
        // Cancel any ongoing zoom animation
        if (this.currentZoomAnimation) {
            this.currentZoomAnimation.abort()
            this.currentZoomAnimation = null
        }

        // Create a new controller for this animation
        const controller = new AbortController()
        this.currentZoomAnimation = controller

        try {
            await this.animateZoomTo(controller.signal, targetScale)
        } catch {
            // animation was aborted
        } finally {
            if (this.currentZoomAnimation === controller) {
                this.currentZoomAnimation = null
            }
        }
    }

    private async animateZoomTo(
        signal: AbortSignal,
        targetScale: number
    ): Promise<void> {
        const currentScale = this.manager.mapConfig.globeSize
        const animatedScale = interpolateNumber(currentScale, targetScale)

        for (let t = this.tickStep; t <= 1; t += this.tickStep) {
            // Check if animation was canceled
            if (signal?.aborted) return

            this.manager.mapConfig.globeSize = animatedScale(easeCubicOut(t))
            await delay(this.msPerTick)
        }

        // Ensure we end exactly at the target value
        this.manager.mapConfig.globeSize = targetScale
    }

    private async animateRotateTo(
        signal: AbortSignal,
        targetCoords: [number, number],
        targetScale?: number
    ): Promise<void> {
        const currentCoords = this.manager.mapConfig.globeRotation
        const animatedCoords = geoInterpolate(currentCoords, targetCoords)

        const currentScale = this.manager.mapConfig.globeSize
        const animatedScale = targetScale
            ? interpolateNumber(currentScale, targetScale)
            : undefined

        for (let t = this.tickStep; t <= 1; t += this.tickStep) {
            // Check if animation was canceled
            if (signal?.aborted) return

            this.manager.mapConfig.globeRotation = animatedCoords(
                easeCubicOut(t)
            )
            if (animatedScale)
                this.manager.mapConfig.globeSize = animatedScale(
                    easeCubicOut(t)
                )
            await delay(this.msPerTick)
        }

        // Ensure we end exactly at the target values
        this.manager.mapConfig.globeRotation = targetCoords
        if (targetScale !== undefined) {
            this.manager.mapConfig.globeSize = targetScale
        }
    }
}
