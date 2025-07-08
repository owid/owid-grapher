import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName, GlobeRegionName } from "@ourworldindata/types"
import { Dropdown } from "./Dropdown"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { GlobeController } from "../mapCharts/GlobeController"

export type MapRegionDropdownValue = GlobeRegionName | "Selection"

export interface MapRegionDropdownManager {
    mapConfig?: MapConfig
    globeController?: GlobeController
    isOnMapTab?: boolean
    mapRegionDropdownValue?: MapRegionDropdownValue
    hideMapRegionDropdown?: boolean
    isMapSelectionEnabled?: boolean
}

interface MapRegionDropdownOption {
    value: MapRegionDropdownValue
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
        const { hideMapRegionDropdown, isOnMapTab, isMapSelectionEnabled } =
            this.manager

        return !!(!hideMapRegionDropdown && isOnMapTab && isMapSelectionEnabled)
    }

    @action.bound onChange(
        selected: MapRegionDropdownOption | null,
        mode: { action: unknown }
    ): void {
        if (mode.action === "clear") {
            this.manager.mapRegionDropdownValue = undefined
            this.mapConfig.region = MapRegionName.World
            this.manager.globeController?.hideGlobe()
            return
        }

        if (!selected) return

        // update active option
        const { value } = selected
        this.manager.mapRegionDropdownValue = value

        // rotate to the selection or region
        if (value === "Selection") {
            this.manager.globeController?.rotateToSelection()
        } else {
            this.mapConfig.region = value
            this.manager.globeController?.rotateToOwidContinent(value)
        }
    }

    @computed private get hasSelectionOption(): boolean {
        return this.mapConfig.selection.hasSelection
    }

    @computed get options(): MapRegionDropdownOption[] {
        const continentOptions: MapRegionDropdownOption[] = Object.values(
            MapRegionName
        )
            .filter((region) => region !== MapRegionName.World)
            .map((region) => {
                return {
                    value: region,
                    label: MAP_REGION_LABELS[region as MapRegionName],
                    trackNote: "map_zoom_to_region",
                }
            })

        const selectionOption: MapRegionDropdownOption = {
            value: "Selection",
            label: "Selection",
            trackNote: "map_zoom_to_region",
        }

        return this.hasSelectionOption
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
        if (!this.showMenu) return null

        return (
            <Dropdown
                className="map-region-dropdown"
                options={this.options}
                onChange={this.onChange}
                value={this.value}
                isClearable
                placeholder="Zoom to..."
                aria-label={
                    this.hasSelectionOption
                        ? "Zoom to selection or continent"
                        : "Zoom to continent"
                }
            />
        )
    }
}
