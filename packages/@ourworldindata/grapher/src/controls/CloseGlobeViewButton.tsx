import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName } from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons"

export interface CloseGlobeViewButtonManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    globeController?: GlobeController
    isFaceted?: boolean
}

@observer
export class CloseGlobeViewButton extends React.Component<{
    manager: CloseGlobeViewButtonManager
}> {
    constructor(props: { manager: CloseGlobeViewButtonManager }) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: CloseGlobeViewButtonManager): boolean {
        const menu = new CloseGlobeViewButton({ manager })
        return menu.showMenu
    }

    @computed private get isUnfaceted2dContinentActive(): boolean {
        return this.mapConfig.is2dContinentActive() && !this.manager.isFaceted
    }

    @computed private get showMenu(): boolean {
        const { isOnMapTab, mapConfig } = this.props.manager

        if (this.isUnfaceted2dContinentActive) return true

        return !!(isOnMapTab && mapConfig?.globe.isActive)
    }

    @computed private get manager(): CloseGlobeViewButtonManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @action.bound private onClick(): void {
        this.mapConfig.region = MapRegionName.World
        this.manager.globeController?.hideGlobe()
        this.manager.globeController?.resetGlobe()
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <button onClick={this.onClick} type="button">
                <FontAwesomeIcon icon={faArrowLeft} />
                {this.isUnfaceted2dContinentActive
                    ? "Back to world map"
                    : "Back to map view"}
            </button>
        ) : null
    }
}
