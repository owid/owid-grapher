import { GlobeConfig } from "./MapConfig"

export class GlobeController {
    private config: GlobeConfig

    constructor(config: GlobeConfig) {
        this.config = config
    }

    toggleGlobe(): void {
        this.config.isActive = !this.config.isActive
    }

    jumpTo({
        coords,
        zoom,
    }: {
        coords?: [number, number]
        zoom?: number
    }): void {
        if (coords) this.config.rotation = coords
        if (zoom) this.config.zoom = zoom
    }
}
