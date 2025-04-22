import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName, GlobeRegionName } from "@ourworldindata/types"
import { Dropdown } from "./Dropdown"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { GlobeController } from "../mapCharts/GlobeController"

export type MapRegionDropdownValue = GlobeRegionName | "Selection"

export interface MapRegionDropdownManager {
    mapConfig?: MapConfig
    globeController?: GlobeController
    isOnMapTab?: boolean
    mapRegionDropdownValue?: MapRegionDropdownValue
    hideMapRegionDropdown?: boolean
    shouldShowEntitySelectorOnMapTab?: boolean
}

interface MapRegionDropdownOption {
    value: MapRegionDropdownValue
    label: string
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

    @computed private get manager(): MapRegionDropdownManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @computed private get showMenu(): boolean {
        const {
                hideMapRegionDropdown,
                isOnMapTab,
                mapConfig,
                shouldShowEntitySelectorOnMapTab,
            } = this.manager,
            { region } = mapConfig ?? {}
        return (
            !hideMapRegionDropdown &&
            !!(isOnMapTab && region) &&
            !!shouldShowEntitySelectorOnMapTab
        )
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound onChange(selected: unknown, mode: { action: unknown }): void {
        if (mode.action === "clear") {
            this.manager.mapRegionDropdownValue = undefined
            this.mapConfig.region = MapRegionName.World
            this.manager.globeController?.hideGlobe()
            return
        }

        if (!selected) return

        // update active option
        const { value } = selected as MapRegionDropdownOption
        this.manager.mapRegionDropdownValue = value

        // rotate to the selection or region
        if (value === "Selection") {
            this.manager.globeController?.rotateToSelection()
        } else {
            this.mapConfig.region = value
            this.manager.globeController?.rotateToOwidContinent(value)
        }
    }

    @computed get options(): MapRegionDropdownOption[] {
        const continentOptions = Object.values(MapRegionName)
            .filter((region) => region !== MapRegionName.World)
            .map((region) => {
                return {
                    value: region,
                    label: MAP_REGION_LABELS[region as MapRegionName],
                }
            })

        const selectionOption: MapRegionDropdownOption = {
            value: "Selection",
            label: "Selection",
        }

        return this.mapConfig.selectedCountries.hasSelection
            ? [selectionOption, ...continentOptions]
            : continentOptions
    }

    @computed get value(): MapRegionDropdownOption | null {
        const { mapRegionDropdownValue } = this.manager
        return (
            this.options.find((opt) => opt.value === mapRegionDropdownValue) ??
            null
        )
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
                    isClearable
                    placeholder="Zoom to..."
                />
            </div>
        ) : null
    }
}
