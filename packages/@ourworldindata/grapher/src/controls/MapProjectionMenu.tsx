import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapProjectionName } from "@ourworldindata/types"
import { MapProjectionLabels } from "../mapCharts/MapProjections"
import { Dropdown } from "./Dropdown"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"

export interface MapProjectionMenuManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapProjectionMenu?: boolean
}

interface MapProjectionMenuItem {
    label: string
    value: MapProjectionName
}

@observer
export class MapProjectionMenu extends React.Component<{
    manager: MapProjectionMenuManager
    maxWidth?: number
}> {
    static shouldShow(manager: MapProjectionMenuManager): boolean {
        const menu = new MapProjectionMenu({ manager })
        return menu.showMenu
    }

    @computed get showMenu(): boolean {
        const { hideMapProjectionMenu, isOnMapTab, mapConfig } =
                this.props.manager,
            { projection } = mapConfig ?? {}
        return !hideMapProjectionMenu && !!(isOnMapTab && projection)
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound onChange(selected: unknown): void {
        const { mapConfig } = this.props.manager
        if (selected && mapConfig)
            mapConfig.projection = (selected as MapProjectionMenuItem).value
    }

    @computed get options(): MapProjectionMenuItem[] {
        return Object.values(MapProjectionName).map((projectName) => {
            return {
                value: projectName,
                label: MapProjectionLabels[projectName],
            }
        })
    }

    @computed get value(): MapProjectionMenuItem | null {
        const { projection } = this.props.manager.mapConfig ?? {}
        return this.options.find((opt) => projection === opt.value) ?? null
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <div
                className="map-projection-menu"
                style={{ maxWidth: this.maxWidth }}
            >
                <Dropdown
                    options={this.options}
                    onChange={this.onChange}
                    value={this.value}
                />
            </div>
        ) : null
    }
}
