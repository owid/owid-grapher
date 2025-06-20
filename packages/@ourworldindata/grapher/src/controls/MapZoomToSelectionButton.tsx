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
            <button onClick={this.onClick} type="button">
                <GlobeIcon size={16} />
                Zoom to selection
            </button>
        ) : null
    }
}

function GlobeIcon({ size }: { size: number }): React.ReactElement {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ width: size, height: size }}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 1.82812C11.4079 1.82814 14.1709 4.59162 14.1709 8C14.1709 11.4079 11.4084 14.1709 8 14.1709C4.59205 14.1709 1.82814 11.4079 1.82812 8C1.82812 4.59204 4.59204 1.82812 8 1.82812ZM9.29102 10.5557C8.44211 10.6265 7.55628 10.6265 6.70703 10.5557C6.79687 10.9936 6.95066 11.5812 7.16113 12.0859C7.28556 12.3843 7.42514 12.6442 7.57617 12.8262C7.72942 13.0108 7.87172 13.0898 8 13.0898C8.12823 13.0898 8.27065 13.0107 8.42383 12.8262C8.57479 12.6442 8.7145 12.3842 8.83887 12.0859C9.04923 11.5813 9.20136 10.9935 9.29102 10.5557ZM3.20117 9.69434C3.71202 11.1414 4.85773 12.2868 6.30469 12.7979C5.94514 12.0915 5.71773 11.221 5.58301 10.416C4.77795 10.2812 3.90745 10.054 3.20117 9.69434ZM12.7979 9.69336C12 10 11.2212 10.2813 10.416 10.416C10.2813 11.2212 10.0531 12.0914 9.69336 12.7979C11.1413 12.2869 12.287 11.1413 12.7979 9.69336ZM9.45508 6.54395C8.50773 6.44784 7.4917 6.44782 6.54492 6.54395C6.44877 7.49128 6.44884 8.50726 6.54492 9.4541C7.49232 9.55025 8.50821 9.55021 9.45508 9.4541C9.55116 8.50712 9.55124 7.49121 9.45508 6.54395ZM10.5557 6.70605C10.6267 7.55585 10.6266 8.44275 10.5557 9.29297C11.0165 9.20187 11.4337 9.08879 11.7949 8.95605C12.2543 8.78723 12.5864 8.6129 12.7998 8.44141C13.015 8.26846 13.0859 8.11873 13.0859 8C13.0859 7.88127 13.0149 7.73157 12.7998 7.55859C12.5864 7.38708 12.2543 7.21281 11.7949 7.04395C11.4336 6.91117 11.0166 6.79684 10.5557 6.70605ZM5.44336 6.70801C5.00545 6.7977 4.41756 6.9508 3.91309 7.16113C3.61495 7.28547 3.35574 7.42525 3.17383 7.57617C2.98922 7.7294 2.91016 7.87173 2.91016 8C2.91023 8.12821 2.98931 8.26969 3.17383 8.42285C3.35579 8.57388 3.61474 8.71445 3.91309 8.83887C4.41751 9.04919 5.00546 9.20131 5.44336 9.29102C5.3726 8.44265 5.37257 7.55635 5.44336 6.70801ZM9.69434 3.20117C10.054 3.9074 10.2812 4.77792 10.416 5.58301C11.221 5.71772 12.0915 5.94515 12.7979 6.30469C12.2867 4.85774 11.1414 3.71198 9.69434 3.20117ZM6.30371 3.20117C4.85759 3.71223 3.71219 4.85758 3.20117 6.30371C3.90732 5.94422 4.77817 5.71775 5.58301 5.58301C5.71775 4.77819 5.94422 3.90736 6.30371 3.20117ZM8 2.91016C7.87172 2.91016 7.7294 2.98922 7.57617 3.17383C7.42527 3.35575 7.28545 3.61497 7.16113 3.91309C6.95079 4.41757 6.7977 5.00545 6.70801 5.44336C7.55685 5.37254 8.44276 5.37255 9.29199 5.44336C9.20211 5.00543 9.04925 4.41752 8.83887 3.91309C8.71452 3.61498 8.57474 3.35575 8.42383 3.17383C8.27059 2.98923 8.12827 2.91017 8 2.91016Z"
                fill="currentColor"
            />
        </svg>
    )
}
