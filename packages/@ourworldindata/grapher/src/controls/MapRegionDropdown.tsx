import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapRegionName } from "@ourworldindata/types"
import { Dropdown } from "./Dropdown"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { GlobeController } from "../mapCharts/GlobeController"
import { getCountriesByRegion } from "../mapCharts/MapHelpers"

export interface MapRegionDropdownManager {
    mapConfig?: MapConfig
    globeController?: GlobeController
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
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
        const { hideMapRegionDropdown, isOnMapTab, isFaceted, mapConfig } =
            this.manager

        return !!(
            !hideMapRegionDropdown &&
            isOnMapTab &&
            // Only show the dropdown if the map is faceted
            isFaceted &&
            // Only offer to switch between 2d regions
            !mapConfig?.globe.isActive
        )
    }

    @action.bound onChange(
        selected: MapRegionDropdownOption | null,
        _mode: { action: unknown }
    ): void {
        const value = selected?.value
        if (!value) return
        this.mapConfig.region = value

        // drop all selected entities not on this continent
        if (this.mapConfig.region !== MapRegionName.World) {
            const countriesInRegion = getCountriesByRegion(
                MAP_REGION_LABELS[this.mapConfig.region]
            )
            if (countriesInRegion) {
                const dropCountries =
                    this.mapConfig.selection.selectedEntityNames.filter(
                        (entityName) => !countriesInRegion.has(entityName)
                    )
                this.mapConfig.selection.deselectEntities(dropCountries)
            }
        }
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

    render(): React.ReactElement | null {
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
