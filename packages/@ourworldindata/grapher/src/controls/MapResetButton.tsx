import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import {
    GrapherWindowType,
    MapRegionName,
    TimeBound,
} from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faRotateLeft } from "@fortawesome/free-solid-svg-icons"
import { match } from "ts-pattern"

interface MapResetButtonProps {
    manager: MapResetButtonManager
    action: "resetView" | "resetZoom"
}

export interface MapResetButtonManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    globeController?: GlobeController
    isFaceted?: boolean
    shouldShowEntitySelectorAs?: GrapherWindowType
    startHandleTimeBound?: TimeBound
    endHandleTimeBound?: TimeBound
}

@observer
export class MapResetButton extends React.Component<{
    manager: MapResetButtonManager
    action: "resetView" | "resetZoom"
}> {
    constructor(props: MapResetButtonProps) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(
        manager: MapResetButtonManager,
        action: "resetView" | "resetZoom"
    ): boolean {
        const menu = new MapResetButton({ manager, action })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { mapConfig } = this
        const { isOnMapTab, isFaceted, shouldShowEntitySelectorAs } =
            this.props.manager

        if (!isOnMapTab) return false

        const shouldShowPanel =
            shouldShowEntitySelectorAs === GrapherWindowType.panel

        const shouldShowResetViewButton =
            shouldShowPanel && (isFaceted || mapConfig.is2dContinentActive())

        const shouldShowResetZoomButton =
            mapConfig.globe.isActive && !shouldShowResetViewButton

        return match(this.props.action)
            .with("resetView", () => shouldShowResetViewButton)
            .with("resetZoom", () => shouldShowResetZoomButton)
            .exhaustive()
    }

    @computed private get manager(): MapResetButtonManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @action.bound private onClick(): void {
        this.mapConfig.region = MapRegionName.World
        this.manager.globeController?.hideGlobe()
        this.manager.globeController?.resetGlobe()

        if (this.props.action === "resetView") {
            this.manager.startHandleTimeBound = this.manager.endHandleTimeBound
        }
    }

    override render(): React.ReactElement | null {
        return this.showMenu ? (
            <button onClick={this.onClick} type="button">
                <FontAwesomeIcon icon={faRotateLeft} />
                {match(this.props.action)
                    .with("resetView", () => "Reset view")
                    .with("resetZoom", () => "Reset zoom")
                    .exhaustive()}
            </button>
        ) : null
    }
}
