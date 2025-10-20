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
    Dropdown,
    DropdownCollection,
    DropdownCollectionItem,
    DropdownOptionGroup,
} from "./Dropdown.js"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { match } from "ts-pattern"
import * as R from "remeda"

export interface MapCountryDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    isFaceted?: boolean
    hideMapRegionDropdown?: boolean
    isMapSelectionEnabled?: boolean
    globeController?: GlobeController
    onMapCountryDropdownFocus?: () => void
}

interface DropdownOption {
    type: "country" | "continent" | "world"
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
        const { isMapSelectionEnabled, isOnMapTab, mapConfig, isFaceted } =
            this.props.manager
        return !!(
            isOnMapTab &&
            !isMapSelectionEnabled &&
            (!mapConfig?.is2dContinentActive() || isFaceted) &&
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

        match(selected.type)
            .with("country", () => {
                // reset the region if a non-world region is currently selected
                if (this.mapConfig.region !== MapRegionName.World) {
                    this.mapConfig.region = MapRegionName.World
                }

                // focus the country on the globe
                this.manager.globeController?.setFocusCountry(selected.value)
                this.manager.globeController?.rotateToCountry(selected.value)
            })
            .with("continent", () => {
                if (this.manager.isFaceted) {
                    this.manager.globeController?.hideGlobe()
                    this.manager.globeController?.resetGlobe()
                    this.mapConfig.region = selected.value as MapRegionName
                } else {
                    this.manager.globeController?.rotateToOwidContinent(
                        selected.value as GlobeRegionName
                    )
                }
            })
            .with("world", () => {
                console.log("sele world")

                this.manager.globeController?.hideGlobe()
                this.manager.globeController?.resetGlobe()
                this.mapConfig.region = MapRegionName.World
            })
            .exhaustive()

        this.searchInput = ""
    }

    @computed private get sortedCountries(): EntityName[] {
        return _.sortBy(mappableCountries.map((country) => country.name))
    }

    @computed private get options(): DropdownCollection<DropdownOption> {
        const {
            localEntityNames = [],
            manager: { isFaceted },
        } = this
        const langs = getUserNavigatorLanguagesNonEnglish()

        const countryOptions: DropdownOption[] | undefined = isFaceted
            ? undefined
            : this.sortedCountries.map((country) => ({
                  type: "country",
                  value: country,
                  label: country,
                  alternativeNames: getRegionAlternativeNames(country, langs),
                  isLocal: this.localEntityNames?.includes(country),
                  trackNote: "map_zoom_mobile",
              }))

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

        const worldOption: DropdownOption = {
            type: "world",
            value: MapRegionName.World,
            label: MAP_REGION_LABELS.World,
            isLocal: false,
            trackNote: "map_zoom_mobile",
        }

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

        const sortedCountryOptions = countryOptions
            ? sortLocalEntitiesToTop(countryOptions)
            : undefined

        const sortedContinentOptions = sortLocalEntitiesToTop(continentOptions)
        if (this.manager.isFaceted) sortedContinentOptions.unshift(worldOption)

        return sortedCountryOptions
            ? [
                  { label: "Continents", options: sortedContinentOptions },
                  { label: "Countries", options: sortedCountryOptions },
              ]
            : sortedContinentOptions
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
        console.log(
            "val",
            this.flatOptions.find((opt) => currentValue === opt.value) ?? null
        )
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

    override componentDidMount(): void {
        void this.populateLocalCountryName()
    }

    override render(): React.ReactElement | null {
        return this.showMenu ? (
            <div className="map-country-dropdown">
                {this.manager.isFaceted ? (
                    <Dropdown<DropdownOption>
                        options={this.options}
                        onChange={this.onChange}
                        value={this.value}
                        aria-label="Filter by"
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
                ) : (
                    <SearchDropdown
                        options={
                            this.searchInput
                                ? this.filteredOptions
                                : this.options
                        }
                        onFocus={this.onFocus}
                        onChange={this.onChange}
                        value={this.value}
                        inputValue={this.searchInput}
                        onInputChange={(inputValue) =>
                            (this.searchInput = inputValue)
                        }
                        placeholder="Zoom to..."
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
                )}
            </div>
        ) : null
    }
}
