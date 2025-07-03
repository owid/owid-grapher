import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { GlobeController } from "../mapCharts/GlobeController"
import { MapRegionName } from "@ourworldindata/types"

export interface ZoomToSelectionButtonManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    globeController?: GlobeController
    isFaceted?: boolean
    shouldShowMapZoomToSelectionButton?: boolean
}

@observer
export class ZoomToSelectionButton extends React.Component<{
    manager: ZoomToSelectionButtonManager
}> {
    static shouldShow(manager: ZoomToSelectionButtonManager): boolean {
        const menu = new ZoomToSelectionButton({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { isOnMapTab, mapConfig, shouldShowMapZoomToSelectionButton } =
            this.props.manager
        return !!(
            isOnMapTab &&
            !mapConfig?.globe.isActive &&
            mapConfig?.region === MapRegionName.World &&
            mapConfig?.selection.hasSelection &&
            !this.manager.isFaceted &&
            shouldShowMapZoomToSelectionButton
        )
    }

    @computed private get manager(): ZoomToSelectionButtonManager {
        return this.props.manager
    }

    @action.bound private onClick(): void {
        this.manager.globeController?.rotateToSelection()
        if (this.manager.mapConfig)
            this.manager.mapConfig.region = MapRegionName.World
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <button onClick={this.onClick} type="button">
                Zoom to selection
            </button>
        ) : null
    }
}
