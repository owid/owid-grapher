import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { Dropdown } from "./Dropdown"
import {
    DEFAULT_BOUNDS,
    EntityName,
    FuzzySearch,
    getRegionAlternativeNames,
    getUserCountryInformation,
    getUserNavigatorLanguagesNonEnglish,
    mappableCountries,
    MapRegionName,
    sortBy,
} from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { GLOBE_COUNTRY_ZOOM } from "../mapCharts/MapChartConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"

export interface MapCountryDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
    shouldUseSimpleMapSearch?: boolean
    globeController?: GlobeController
    onMapCountryDropdownFocus?: () => void
}

interface DropdownOption {
    label: string
    value: string
    isLocal?: boolean
    alternativeNames?: string[]
}

@observer
export class MapCountryDropdown extends React.Component<{
    manager: MapCountryDropdownManager
    maxWidth?: number
}> {
    @observable private searchInput = ""
    @observable private localCountryName?: EntityName

    static shouldShow(manager: MapCountryDropdownManager): boolean {
        const menu = new MapCountryDropdown({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { shouldUseSimpleMapSearch, isOnMapTab } = this.props.manager
        return !!isOnMapTab && !!shouldUseSimpleMapSearch
    }

    @computed private get manager(): MapCountryDropdownManager {
        return this.props.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed get fuzzy(): FuzzySearch<DropdownOption> {
        return FuzzySearch.withKeyArray(
            this.options,
            (entity) => [entity.label, ...(entity.alternativeNames ?? [])],
            (entity) => entity.label
        )
    }

    @action.bound private onFocus(): void {
        this.manager.globeController?.dismissCountryFocus()
        this.manager.onMapCountryDropdownFocus?.()
    }

    @action.bound private onChange(selected: unknown): void {
        const option = selected as DropdownOption

        const isGlobeActive = this.mapConfig.globe.isActive
        const region = this.mapConfig.region

        // reset the region if a non-world region is currently selected
        if (!isGlobeActive && region !== MapRegionName.World) {
            this.manager.globeController?.jumpToRegion(region)
            this.mapConfig.region = MapRegionName.World
        }

        // switch to the globe if not already active
        if (!isGlobeActive) {
            this.manager.globeController?.jumpToCountryOffset(option.value)
            this.manager.globeController?.showGlobe()
        }

        // focus on the country and rotate to it
        this.manager.globeController?.focusOnCountry(option.value)
        this.manager.globeController?.rotateToCountry(
            option.value,
            GLOBE_COUNTRY_ZOOM
        )
    }

    @computed private get sortedCountries(): EntityName[] {
        return sortBy(mappableCountries.map((country) => country.name))
    }

    @computed private get options(): DropdownOption[] {
        const langs = getUserNavigatorLanguagesNonEnglish()

        const toOption = (country: EntityName): DropdownOption => ({
            value: country,
            label: country,
            alternativeNames: getRegionAlternativeNames(country, langs),
        })

        if (this.localCountryName) {
            return [
                { ...toOption(this.localCountryName), isLocal: true },
                ...this.sortedCountries
                    .filter((country) => country !== this.localCountryName)
                    .map(toOption),
            ]
        }

        return this.sortedCountries.map(toOption)
    }

    @computed private get filteredOptions(): DropdownOption[] {
        if (!this.searchInput) return this.options
        return this.fuzzy.search(this.searchInput)
    }

    @computed private get value(): DropdownOption | null {
        const { focusCountry } = this.manager.mapConfig?.globe ?? {}
        if (!focusCountry) return null
        return this.options.find((opt) => focusCountry === opt.value) ?? null
    }

    @action.bound async populateLocalEntities(): Promise<void> {
        try {
            const localCountryInfo = await getUserCountryInformation()
            if (!localCountryInfo) return
            this.localCountryName = localCountryInfo.name
        } catch {
            // ignore
        }
    }

    componentDidMount(): void {
        void this.populateLocalEntities()
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <div
                className="map-country-dropdown"
                style={{ width: this.maxWidth }}
            >
                <Dropdown
                    options={
                        this.searchInput ? this.filteredOptions : this.options
                    }
                    onFocus={this.onFocus}
                    onChange={this.onChange}
                    value={this.value}
                    isSearchable={true}
                    filterOption={() => true} // disable the default filtering
                    onInputChange={(inputValue) =>
                        (this.searchInput = inputValue)
                    }
                    placeholder="Zoom to a country..."
                    formatOptionLabel={(option) => (
                        <>
                            {option.label}
                            {option.isLocal && (
                                <FontAwesomeIcon
                                    className="local-icon"
                                    icon={faLocationArrow}
                                />
                            )}
                        </>
                    )}
                />
            </div>
        ) : null
    }
}
