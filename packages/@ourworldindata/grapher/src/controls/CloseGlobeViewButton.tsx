import * as React from "react"
import { computed, action } from "mobx"
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
}

@observer
export class CloseGlobeViewButton extends React.Component<{
    manager: CloseGlobeViewButtonManager
}> {
    static shouldShow(manager: CloseGlobeViewButtonManager): boolean {
        const menu = new CloseGlobeViewButton({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { isOnMapTab, mapConfig } = this.props.manager
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
            <button className="CloseGlobeViewButton" onClick={this.onClick}>
                <FontAwesomeIcon icon={faArrowLeft} />
                Back to map view
            </button>
        ) : null
    }
}
