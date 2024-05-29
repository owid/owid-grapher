import { easeCubicOut } from "d3-ease"
import { geoInterpolate } from "d3-geo"

import { MapProjectionName } from "@ourworldindata/types"
import { delay } from "@ourworldindata/utils"

import { VIEWPORTS } from "./MapChartConstants"

interface GlobeManager {
    isGlobe: boolean
    globeRotation: [number, number]
}

export class GlobeController {
    private manager: GlobeManager

    private tickStep = 0.1
    private msPerTick = 60

    constructor(manager: GlobeManager) {
        this.manager = manager
    }

    async rotateTo(coords: [number, number]): Promise<void> {
        if (this.manager.isGlobe) {
            void this.animateRotateTo(coords)
        } else {
            this.manager.globeRotation = coords
        }
    }

    async rotateToProjection(projectionName: MapProjectionName): Promise<void> {
        const targetCoords = VIEWPORTS[projectionName].rotation
        if (this.manager.isGlobe) {
            void this.animateRotateTo(targetCoords)
        } else {
            this.manager.globeRotation = targetCoords
        }
    }

    private async animateRotateTo(
        targetCoords: [number, number]
    ): Promise<void> {
        const currentCoords = this.manager.globeRotation
        const animatedCoords = geoInterpolate(currentCoords, targetCoords)
        for (let t = this.tickStep; t <= 1; t += this.tickStep) {
            this.manager.globeRotation = animatedCoords(easeCubicOut(t))
            await delay(this.msPerTick)
        }
    }
}
