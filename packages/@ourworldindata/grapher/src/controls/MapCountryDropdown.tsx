import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"
import { SearchDropdown } from "./SearchDropdown"

export interface MapCountryDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
    shouldShowEntitySelectorOnMapTab?: boolean
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
        const { shouldShowEntitySelectorOnMapTab, isOnMapTab, mapConfig } =
            this.props.manager
        return !!(
            isOnMapTab &&
            !shouldShowEntitySelectorOnMapTab &&
            !mapConfig?.globe.isActive
        )
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
        const country = option.value

        // reset the region if a non-world region is currently selected
        const region = this.mapConfig.region
        if (region !== MapRegionName.World) {
            this.manager.globeController?.jumpToRegion(region)
            this.mapConfig.region = MapRegionName.World
        }

        // focus the country on the globe
        this.manager.globeController?.focusOnCountry(country)
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
                <SearchDropdown
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
                    placeholder="Search to zoom..."
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
