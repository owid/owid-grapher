import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
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
import {
    DropdownCollection,
    DropdownCollectionItem,
    DropdownOptionGroup,
} from "./Dropdown.js"
import { getCountriesByRegion } from "../mapCharts/MapHelpers"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { match } from "ts-pattern"
import * as R from "remeda"

export interface MapCountryDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapRegionDropdown?: boolean
    isMapSelectionEnabled?: boolean
    globeController?: GlobeController
    isFaceted?: boolean
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

type GroupedDropdownOption = DropdownOptionGroup<DropdownOption>

function isGroupedOption(
    item: DropdownCollectionItem<DropdownOption>
): item is GroupedDropdownOption {
    return (item as GroupedDropdownOption).options !== undefined
}

@observer
export class MapCountryDropdown extends React.Component<{
    manager: MapCountryDropdownManager
}> {
    private searchInput = ""
    private localEntityNames: EntityName[] | undefined = undefined

    constructor(props: { manager: MapCountryDropdownManager }) {
        super(props)

        makeObservable<MapCountryDropdown, "searchInput" | "localEntityNames">(
            this,
            {
                searchInput: observable,
                localEntityNames: observable,
            }
        )
    }

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
        return this.props.manager
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

        // if a 2d continent is active or we're in faceting mode,
        // we don't want to switch to the globe
        const isGlobeDisabled =
            this.mapConfig.is2dContinentActive() || this.manager.isFaceted

        match(selected.type)
            .with("country", () => {
                const country = selected.value

                this.manager.globeController?.setFocusCountry(country)

                if (!isGlobeDisabled) {
                    this.manager.globeController?.rotateToCountry(country)
                }
            })
            .with("continent", () => {
                const continent = selected.value as GlobeRegionName

                this.mapConfig.region = continent

                if (!isGlobeDisabled) {
                    this.manager.globeController?.rotateToOwidContinent(
                        continent
                    )
                }
            })
            .exhaustive()

        this.searchInput = ""
    }

    @computed private get availableCountries(): EntityName[] {
        const mappableCountryNames = mappableCountries
            .map((country) => country.name)
            // Exclude Antarctica since it's not shown on the the 2D
            .filter((countryName) => countryName !== "Antarctica")

        // Only show the countries for the active continent if in 2d mode
        if (this.mapConfig.is2dContinentActive()) {
            const countriesInRegion = getCountriesByRegion(
                MAP_REGION_LABELS[this.mapConfig.region]
            )
            if (!countriesInRegion) return mappableCountryNames
            return Array.from(countriesInRegion)
        }

        return mappableCountryNames
    }

    @computed private get sortedCountries(): EntityName[] {
        return _.sortBy(this.availableCountries)
    }

    @computed private get options(): DropdownCollection<DropdownOption> {
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

        const continentOptionsIncludingWorld: DropdownOption[] = Object.values(
            MapRegionName
        ).map((region) => {
            return {
                type: "continent",
                value: region,
                label: MAP_REGION_LABELS[region as MapRegionName],
                isLocal: this.localEntityNames?.includes(region),
                trackNote: "map_zoom_mobile",
            }
        })

        const continentOptions =
            this.manager.isFaceted || this.mapConfig.is2dContinentActive()
                ? continentOptionsIncludingWorld
                : continentOptionsIncludingWorld.filter(
                      (option) => option.value !== MapRegionName.World
                  )

        const sortLocalEntitiesAndWorldToTop = (
            options: DropdownOption[]
        ): DropdownOption[] => {
            if (localEntityNames.length === 0) return options
            const [local, nonLocal] = R.partition(
                options,
                (option) =>
                    !!option.isLocal || option.value === MapRegionName.World
            )
            return [...local, ...nonLocal]
        }

        return [
            {
                label: "Continents",
                options: sortLocalEntitiesAndWorldToTop(continentOptions),
            },
            {
                label: "Countries",
                options: sortLocalEntitiesAndWorldToTop(countryOptions),
            },
        ]
    }

    @computed private get flatOptions(): DropdownOption[] {
        return this.options.flatMap((item) =>
            isGroupedOption(item) ? item.options : [item]
        )
    }

    @computed
    private get filteredOptions(): DropdownCollection<DropdownOption> {
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

    @computed private get placeholder(): string {
        if (
            this.mapConfig.globe.isActive ||
            (this.mapConfig.region === MapRegionName.World &&
                !this.manager.isFaceted)
        )
            return "Zoom to..."
        return "Search for a country"
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

    override componentDidMount(): void {
        void this.populateLocalCountryName()
    }

    override render(): React.ReactElement | null {
        return this.showMenu ? (
            <div className="map-country-dropdown">
                <SearchDropdown
                    options={
                        this.searchInput ? this.filteredOptions : this.options
                    }
                    onFocus={this.onFocus}
                    onChange={this.onChange}
                    value={this.value}
                    inputValue={this.searchInput}
                    onInputChange={(inputValue) =>
                        (this.searchInput = inputValue)
                    }
                    placeholder={this.placeholder}
                    aria-label="Search for country or continent"
                    renderMenuOption={(option) => (
                        <>
                            {option.label}
                            {option.isLocal && (
                                <FontAwesomeIcon
                                    className="map-country-dropdown-local-icon"
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
