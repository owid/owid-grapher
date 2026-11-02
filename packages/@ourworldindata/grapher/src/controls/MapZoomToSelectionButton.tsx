import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { GlobeController } from "../mapCharts/GlobeController"
import { MapRegionName } from "@ourworldindata/types"

export interface MapZoomToSelectionButtonManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    globeController?: GlobeController
    isFaceted?: boolean
    isMapSelectionEnabled?: boolean
}

interface MapZoomToSelectionButtonProps {
    manager: MapZoomToSelectionButtonManager
}

@observer
export class MapZoomToSelectionButton extends React.Component<MapZoomToSelectionButtonProps> {
    constructor(props: MapZoomToSelectionButtonProps) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: MapZoomToSelectionButtonManager): boolean {
        const menu = new MapZoomToSelectionButton({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { isOnMapTab, mapConfig, isMapSelectionEnabled } =
            this.props.manager
        return !!(
            isOnMapTab &&
            mapConfig?.selection.hasSelection &&
            mapConfig?.region === MapRegionName.World &&
            !mapConfig?.globe.isActive &&
            !this.manager.isFaceted &&
            isMapSelectionEnabled
        )
    }

    @computed private get manager(): MapZoomToSelectionButtonManager {
        return this.props.manager
    }

    @action.bound private onClick(): void {
        this.manager.globeController?.rotateToSelection()
        if (this.manager.mapConfig)
            this.manager.mapConfig.region = MapRegionName.World
    }

    override render(): React.ReactElement | null {
        return this.showMenu ? (
            <button
                onClick={this.onClick}
                type="button"
                data-track-note="map_zoom_to_selection"
                className="menu-toggle"
            >
                <GlobeIcon size={16} />
                <span className="label">Zoom to selection</span>
            </button>
        ) : null
    }
}

function GlobeIcon({ size }: { size: number }): React.ReactElement {
    return (
        <svg
            width="16"
            height="16"
            fill="none"
            style={{ width: size, height: size }}
            viewBox="0 0 16 16"
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M8 1.828a6.172 6.172 0 1 1-.002 12.344A6.172 6.172 0 0 1 8 1.828m1.291 8.728c-.849.07-1.735.07-2.584 0 .09.438.244 1.025.454 1.53.125.298.264.558.415.74.153.185.296.264.424.264s.27-.08.424-.264c.15-.182.29-.442.415-.74.21-.505.362-1.093.452-1.53m-6.09-.862a5.1 5.1 0 0 0 3.104 3.104c-.36-.707-.587-1.577-.722-2.382-.805-.135-1.676-.362-2.382-.722m9.597 0c-.798.306-1.577.587-2.382.722-.135.805-.363 1.675-.723 2.382a5.1 5.1 0 0 0 3.105-3.105m-3.343-3.15a14.7 14.7 0 0 0-2.91 0 14.7 14.7 0 0 0 0 2.91 14.7 14.7 0 0 0 2.91 0 14.7 14.7 0 0 0 0-2.91m1.1.162c.072.85.072 1.737 0 2.587a8 8 0 0 0 1.24-.337c.46-.169.791-.343 1.005-.515.215-.173.286-.322.286-.441s-.071-.268-.286-.441c-.214-.172-.546-.346-1.005-.515a8 8 0 0 0-1.24-.338m-5.112.002a9 9 0 0 0-1.53.453 3 3 0 0 0-.74.415c-.184.153-.263.296-.263.424s.08.27.264.423c.182.15.44.291.74.416.504.21 1.091.362 1.53.452a15.7 15.7 0 0 1 0-2.583M9.695 3.2c.36.706.587 1.577.722 2.382.805.135 1.675.362 2.382.722A5.1 5.1 0 0 0 9.694 3.2m-3.39 0A5.1 5.1 0 0 0 3.2 6.304c.706-.36 1.577-.586 2.382-.721.135-.805.361-1.676.72-2.382M8 2.911c-.128 0-.27.078-.424.263-.15.182-.29.441-.415.74a9 9 0 0 0-.453 1.53 15.7 15.7 0 0 1 2.584 0 9 9 0 0 0-.453-1.53 3 3 0 0 0-.415-.74C8.27 2.989 8.128 2.91 8 2.91"
                clipRule="evenodd"
            />
        </svg>
    )
}
