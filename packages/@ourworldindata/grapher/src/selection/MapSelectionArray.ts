import { computed, makeObservable } from "mobx"
import { SelectionArray } from "./SelectionArray"
import {
    Aggregate,
    checkHasMembers,
    checkIsCountry,
    Continent,
    Country,
    EntityName,
    excludeUndefined,
    getCountryNamesForRegion,
    getRegionByName,
    IncomeGroup,
    Region,
} from "@ourworldindata/utils"
import * as R from "remeda"

export class MapSelectionArray extends SelectionArray {
    constructor(selectedEntityNames: EntityName[] = []) {
        super(selectedEntityNames)

        makeObservable(this)
    }

    @computed private get selectedEntitiesWithRegionInfo(): Region[] {
        return excludeUndefined(
            this.selectedEntityNames.map((name) => getRegionByName(name))
        )
    }

    @computed get selectedCountries(): Country[] {
        return this.selectedEntitiesWithRegionInfo.filter((region) =>
            checkIsCountry(region)
        )
    }

    @computed get selectedCountryNames(): EntityName[] {
        return this.selectedCountries.map((country) => country.name)
    }

    @computed get hasCountries(): boolean {
        return this.selectedCountries.length > 0
    }

    /**
     * Subset of the selected countries that are part of the selected regions.
     * Returns all selected countries if no region is selected.
     */
    @computed get selectedCountryNamesInForeground(): EntityName[] {
        if (!this.hasRegions) return this.selectedCountryNames
        const memberCountries = this.countryNamesForSelectedRegionsSet
        return this.selectedCountries
            .filter((country) => memberCountries.has(country.name))
            .map((country) => country.name)
    }

    /**
     * Complement of `selectedCountryNamesInForeground`.
     * Subset of the selected countries that are not part of any selected region.
     * Returns an empty list if no region is selected.
     */
    @computed get selectedCountryNamesInBackground(): EntityName[] {
        return R.difference(
            this.selectedCountryNames,
            this.selectedCountryNamesInForeground
        )
    }

    /**
     * List of selected regions where a region is any geographic entity that
     * is made up of a set of countries.
     */
    @computed get selectedRegions(): (Continent | Aggregate | IncomeGroup)[] {
        return this.selectedEntitiesWithRegionInfo.filter(
            (region): region is Continent | Aggregate | IncomeGroup =>
                checkHasMembers(region) && region.code !== "OWID_WRL"
        )
    }

    @computed get selectedRegionNames(): EntityName[] {
        return this.selectedRegions.map((region) => region.name)
    }

    @computed get hasRegions(): boolean {
        return this.selectedRegions.length > 0
    }

    @computed get countryNamesForSelectedRegionsSet(): Set<EntityName> {
        return new Set(
            this.selectedRegions.flatMap((region) =>
                getCountryNamesForRegion(region)
            )
        )
    }

    @computed get countryNamesForSelectedRegions(): EntityName[] {
        return Array.from(this.countryNamesForSelectedRegionsSet)
    }
}
