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
import { measureButtonWidth } from "./controlsRow/ControlsRowConstants"

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
export class MapResetButton extends React.Component<MapResetButtonProps> {
    constructor(props: MapResetButtonProps) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(
        manager: MapResetButtonManager,
        action: MapResetButtonProps["action"]
    ): boolean {
        const { isOnMapTab, isFaceted, shouldShowEntitySelectorAs } = manager

        if (!isOnMapTab) return false

        const mapConfig = manager.mapConfig ?? new MapConfig()

        const shouldShowPanel =
            shouldShowEntitySelectorAs === GrapherWindowType.panel

        const shouldShowResetViewButton =
            shouldShowPanel && (isFaceted || mapConfig.is2dContinentActive())

        const shouldShowResetZoomButton =
            mapConfig.globe.isActive && !shouldShowResetViewButton

        return match(action)
            .with("resetView", () => shouldShowResetViewButton)
            .with("resetZoom", () => shouldShowResetZoomButton)
            .exhaustive()
    }

    static estimateWidth(
        manager: MapResetButtonManager,
        action: MapResetButtonProps["action"]
    ): number {
        if (!MapResetButton.shouldShow(manager, action)) return 0
        return measureButtonWidth(makeResetButtonLabel(action))
    }

    @computed private get shouldShow(): boolean {
        return MapResetButton.shouldShow(this.props.manager, this.props.action)
    }

    @computed private get manager(): MapResetButtonManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @computed private get label(): string {
        return makeResetButtonLabel(this.props.action)
    }

    @computed private get trackNote(): string {
        return match(this.props.action)
            .with("resetView", () => "map_reset_view")
            .with("resetZoom", () => "map_reset_zoom")
            .exhaustive()
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
        return this.shouldShow ? (
            <button
                type="button"
                data-track-note={this.trackNote}
                onClick={this.onClick}
                className="menu-toggle"
            >
                <FontAwesomeIcon icon={faRotateLeft} />
                <span className="label">{this.label}</span>
            </button>
        ) : null
    }
}

function makeResetButtonLabel(action: MapResetButtonProps["action"]): string {
    return match(action)
        .with("resetView", () => "Reset view")
        .with("resetZoom", () => "Reset zoom")
        .exhaustive()
}
