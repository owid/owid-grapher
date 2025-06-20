import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName } from "@ourworldindata/types"
import { Dropdown } from "./Dropdown"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { GlobeController } from "../mapCharts/GlobeController"

export interface MapRegionDropdownManager {
    mapConfig?: MapConfig
    globeController?: GlobeController
    isOnMapTab?: boolean
    isFaceted?: boolean
}

interface MapRegionDropdownOption {
    value: MapRegionName
    label: string
    trackNote: "map_zoom_to_region"
}

@observer
export class MapRegionDropdown extends React.Component<{
    manager: MapRegionDropdownManager
}> {
    constructor(props: { manager: MapRegionDropdownManager }) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: MapRegionDropdownManager): boolean {
        const menu = new MapRegionDropdown({ manager })
        return menu.showMenu
    }

    @computed private get manager(): MapRegionDropdownManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @computed private get showMenu(): boolean {
        const { isOnMapTab, isFaceted, mapConfig } = this.manager

        return !!(
            isOnMapTab &&
            // Hide the dropdown when the globe is active
            !mapConfig?.globe.isActive &&
            // Hide the dropdown when the map is not faceted unless a 2d continent is active
            !(this.mapConfig.region === MapRegionName.World && !isFaceted)
        )
    }

    @action.bound onChange(selected: MapRegionDropdownOption | null): void {
        const value = selected?.value
        if (!value) return

        // Update the current region
        this.mapConfig.region = value
    }

    @computed get options(): MapRegionDropdownOption[] {
        const continentOptions: MapRegionDropdownOption[] = Object.values(
            MapRegionName
        ).map((region) => {
            return {
                value: region,
                label: MAP_REGION_LABELS[region as MapRegionName],
                trackNote: "map_zoom_to_region",
            }
        })

        return continentOptions
    }

    @computed get value(): MapRegionDropdownOption | null {
        const { region } = this.mapConfig
        return this.options.find((opt) => opt.value === region) ?? null
    }

    override render(): React.ReactElement | null {
        if (!this.showMenu) return null

        return (
            <Dropdown
                className="map-region-dropdown"
                options={this.options}
                onChange={this.onChange}
                value={this.value}
                aria-label="Select continent"
            />
        )
    }
}
