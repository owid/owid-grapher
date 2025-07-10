import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import { MapConfig } from "../mapCharts/MapConfig"
import {
    EntityName,
    FuzzySearch,
    getRegionAlternativeNames,
    getUserNavigatorLanguagesNonEnglish,
    GlobeRegionName,
    mappableCountries,
    MapRegionName,
    checkIsOwidIncomeGroupName,
    getUserCountryInformation,
    regions,
} from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"
import { SearchDropdown } from "./SearchDropdown"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { match } from "ts-pattern"
import * as R from "remeda"

export interface MapCountryDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
    isMapSelectionEnabled?: boolean
    globeController?: GlobeController
    onMapCountryDropdownFocus?: () => void
}

interface DropdownOption {
    type: "country" | "continent"
    label: string
    value: string
    isLocal?: boolean
    alternativeNames?: string[]
    trackNote: "map_zoom_mobile"
}

interface GroupedDropdownOption {
    label: string
    options: DropdownOption[]
}

@observer
export class MapCountryDropdown extends ObservedReactComponent<{
    manager: MapCountryDropdownManager
}> {
    @observable private searchInput = ""
    @observable private localEntityNames?: EntityName[]

    static shouldShow(manager: MapCountryDropdownManager): boolean {
        const menu = new MapCountryDropdown({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { isMapSelectionEnabled, isOnMapTab, mapConfig } =
            this.props.manager
        return !!(
            isOnMapTab &&
            !isMapSelectionEnabled &&
            !mapConfig?.globe.isActive
        )
    }

    @computed private get manager(): MapCountryDropdownManager {
        return this.observedProps.manager
    }

    @computed private get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @computed get fuzzy(): FuzzySearch<DropdownOption> {
        return FuzzySearch.withKeyArray(
            this.flatOptions,
            (entity) => [entity.label, ...(entity.alternativeNames ?? [])],
            (entity) => entity.label
        )
    }

    @action.bound private onFocus(): void {
        this.manager.globeController?.dismissCountryFocus()
        this.manager.onMapCountryDropdownFocus?.()
    }

    @action.bound private onChange(selected: DropdownOption | null): void {
        if (!selected?.value) return

        match(selected.type)
            .with("country", () => {
                // reset the region if a non-world region is currently selected
                if (this.mapConfig.region !== MapRegionName.World) {
                    this.mapConfig.region = MapRegionName.World
                }

                // focus the country on the globe
                this.manager.globeController?.focusOnCountry(selected.value)
            })
            .with("continent", () => {
                this.manager.globeController?.rotateToOwidContinent(
                    selected.value as GlobeRegionName
                )
            })
            .exhaustive()
    }

    @computed private get sortedCountries(): EntityName[] {
        return _.sortBy(mappableCountries.map((country) => country.name))
    }

    @computed private get options(): GroupedDropdownOption[] {
        const { localEntityNames = [] } = this
        const langs = getUserNavigatorLanguagesNonEnglish()

        const countryOptions: DropdownOption[] = this.sortedCountries.map(
            (country) => ({
                type: "country",
                value: country,
                label: country,
                alternativeNames: getRegionAlternativeNames(country, langs),
                isLocal: this.localEntityNames?.includes(country),
                trackNote: "map_zoom_mobile",
            })
        )

        const continentOptions: DropdownOption[] = Object.values(MapRegionName)
            .filter((region) => region !== MapRegionName.World)
            .map((region) => {
                return {
                    type: "continent",
                    value: region,
                    label: MAP_REGION_LABELS[region as MapRegionName],
                    isLocal: this.localEntityNames?.includes(region),
                    trackNote: "map_zoom_mobile",
                }
            })

        const sortLocalEntitiesToTop = (
            options: DropdownOption[]
        ): DropdownOption[] => {
            if (localEntityNames.length === 0) return options
            const [local, nonLocal] = R.partition(
                options,
                (option) => !!option.isLocal
            )
            return [...local, ...nonLocal]
        }

        return [
            {
                label: "Continents",
                options: sortLocalEntitiesToTop(continentOptions),
            },
            {
                label: "Countries",
                options: sortLocalEntitiesToTop(countryOptions),
            },
        ]
    }

    @computed private get flatOptions(): DropdownOption[] {
        return this.options.flatMap((option) => option.options)
    }

    @computed private get filteredOptions():
        | DropdownOption[]
        | GroupedDropdownOption[] {
        if (!this.searchInput) return this.options
        return this.fuzzy.search(this.searchInput)
    }

    @computed private get value(): DropdownOption | null {
        const { region } = this.mapConfig
        const { focusCountry } = this.manager.mapConfig?.globe ?? {}
        const currentValue = focusCountry ?? region
        return (
            this.flatOptions.find((opt) => currentValue === opt.value) ?? null
        )
    }

    @action.bound async populateLocalCountryName(): Promise<void> {
        try {
            const localCountryInfo = await getUserCountryInformation()
            if (!localCountryInfo) return

            const countryRegionsWithoutIncomeGroups = localCountryInfo.regions
                ? localCountryInfo.regions.filter(
                      (region) => !checkIsOwidIncomeGroupName(region)
                  )
                : []

            const userEntityCodes = [
                localCountryInfo.code,
                ...countryRegionsWithoutIncomeGroups,
            ]

            const userRegions = regions.filter((region) =>
                userEntityCodes.includes(region.code)
            )

            const sortedUserRegions = _.sortBy(userRegions, (region) =>
                userEntityCodes.indexOf(region.code)
            )

            const localEntityNames = sortedUserRegions.map(
                (region) => region.name
            )

            this.localEntityNames = localEntityNames
        } catch {
            // ignore
        }
    }

    componentDidMount(): void {
        void this.populateLocalCountryName()
    }

    render(): React.ReactElement | null {
        return this.showMenu ? (
            <div className="map-country-dropdown">
                <SearchDropdown
                    options={
                        this.searchInput ? this.filteredOptions : this.options
                    }
                    onFocus={this.onFocus}
                    onChange={this.onChange}
                    value={this.value}
                    filterOption={() => true} // disable the default filtering
                    onInputChange={(inputValue) =>
                        (this.searchInput = inputValue)
                    }
                    placeholder="Zoom to..."
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
