import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName } from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons"
import { MapRegionDropdownValue } from "./MapRegionDropdown"

export interface CloseGlobeViewButtonManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    globeController?: GlobeController
    mapRegionDropdownValue?: MapRegionDropdownValue
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
        this.manager.mapRegionDropdownValue = undefined
        this.mapConfig.region = MapRegionName.World
        this.manager.globeController?.hideGlobe()
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
