import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons"

export interface CloseGlobeViewButtonManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    globeController?: GlobeController
    onCloseGlobeViewButtonClick?: () => void
}

@observer
export class CloseGlobeViewButton extends React.Component<{
    manager: CloseGlobeViewButtonManager
    maxWidth?: number
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

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound private onClick(): void {
        this.manager.globeController?.toggleGlobe()
        this.manager.onCloseGlobeViewButtonClick?.()
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <button
                className="CloseGlobeViewButton"
                onClick={this.onClick}
                style={{ maxWidth: this.maxWidth }}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
                Back to map view
            </button>
        ) : null
    }
}
