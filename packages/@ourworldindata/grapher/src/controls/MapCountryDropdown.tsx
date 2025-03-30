import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { Dropdown } from "./Dropdown"
import { DEFAULT_BOUNDS, mappableCountries } from "@ourworldindata/utils"

export interface MapCountryDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
    shouldUseSimpleMapSearch?: boolean
}

interface DropdownOption {
    label: string
    value: string
}

@observer
export class MapCountryDropdown extends React.Component<{
    manager: MapCountryDropdownManager
    maxWidth?: number
}> {
    static shouldShow(manager: MapCountryDropdownManager): boolean {
        const menu = new MapCountryDropdown({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { shouldUseSimpleMapSearch, isOnMapTab } = this.props.manager
        return !!isOnMapTab && !!shouldUseSimpleMapSearch
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound private onChange(selected: unknown): void {
        const { mapConfig } = this.props.manager
        if (selected && mapConfig)
            mapConfig.globe.zoomCountry = (selected as DropdownOption).value
    }

    @computed private get options(): DropdownOption[] {
        return mappableCountries.map((country) => ({
            value: country.name,
            label: country.name,
        }))
    }

    @computed private get value(): DropdownOption | null {
        const { zoomCountry } = this.props.manager.mapConfig?.globe ?? {}
        if (!zoomCountry) return null
        return this.options.find((opt) => zoomCountry === opt.value) ?? null
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <div
                className="map-country-dropdown"
                style={{ width: this.maxWidth }}
            >
                <Dropdown
                    options={this.options}
                    onChange={this.onChange}
                    value={this.value}
                    isSearchable={true}
                    placeholder="Zoom to a country..."
                />
            </div>
        ) : null
    }
}
