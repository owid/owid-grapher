import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName } from "@ourworldindata/types"
import { MAP_REGION_LABELS } from "../mapCharts/MapProjections"
import { Dropdown } from "./Dropdown"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"

export interface MapRegionDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
}

interface DropdownOption {
    label: string
    value: MapRegionName
}

@observer
export class MapRegionDropdown extends React.Component<{
    manager: MapRegionDropdownManager
    maxWidth?: number
}> {
    static shouldShow(manager: MapRegionDropdownManager): boolean {
        const menu = new MapRegionDropdown({ manager })
        return menu.showMenu
    }

    @computed get showMenu(): boolean {
        const { hideMapRegionDropdown, isOnMapTab, mapConfig } =
                this.props.manager,
            { region, globe } = mapConfig ?? {}
        return (
            !hideMapRegionDropdown &&
            !!(isOnMapTab && region) &&
            !globe?.isActive
        )
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound onChange(selected: unknown): void {
        const { mapConfig } = this.props.manager
        if (selected && mapConfig)
            mapConfig.region = (selected as DropdownOption).value
    }

    @computed get options(): DropdownOption[] {
        return Object.values(MapRegionName).map((region) => {
            return {
                value: region,
                label: MAP_REGION_LABELS[region],
            }
        })
    }

    @computed get value(): DropdownOption | null {
        const { region } = this.props.manager.mapConfig ?? {}
        return this.options.find((opt) => region === opt.value) ?? null
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <div
                className="map-region-dropdown"
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
