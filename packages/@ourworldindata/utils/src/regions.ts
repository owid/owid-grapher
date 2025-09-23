import * as _ from "lodash-es"
import entities from "./regions.json"
import { lazy } from "./Util.js"

export enum RegionType {
    Country = "country",
    Other = "other",
    Aggregate = "aggregate",
    Continent = "continent",
    IncomeGroup = "income_group",
}

export interface BaseRegion {
    regionType: RegionType
    name: string
    code: string
    slug: string
}

export interface Country extends BaseRegion {
    regionType: RegionType.Country | RegionType.Other
    shortCode?: string
    shortName?: string
    isMappable?: boolean
    isHistorical?: boolean
    isUnlisted?: boolean
    variantNames?: string[]
}

export interface Aggregate extends BaseRegion {
    regionType: RegionType.Aggregate
    definedBy?: AggregateSource
    translationCodes?: string[]
    members: string[]
}

export interface Continent extends BaseRegion {
    name: OwidContinentName
    regionType: RegionType.Continent
    translationCodes?: string[]
    members: string[]
}

export interface IncomeGroup extends BaseRegion {
    name: OwidIncomeGroupName
    regionType: RegionType.IncomeGroup
    members: string[]
}

export type Region = Country | Aggregate | Continent | IncomeGroup

export const regions: Region[] = entities as Region[]

type OwidContinentName =
    | "Africa"
    | "Asia"
    | "Europe"
    | "North America"
    | "Oceania"
    | "South America"

export type OwidIncomeGroupName =
    | "OWID_LIC"
    | "OWID_LMC"
    | "OWID_UMC"
    | "OWID_HIC"

export const aggregateSources = ["who", "unsd", "wb", "unsdg"] as const
export type AggregateSource = (typeof aggregateSources)[number]

export function checkIsOwidIncomeGroupName(
    name: string
): name is OwidIncomeGroupName {
    return (
        name === "OWID_LIC" ||
        name === "OWID_LMC" ||
        name === "OWID_UMC" ||
        name === "OWID_HIC"
    )
}

export function checkIsCountry(region: Region): region is Country {
    return (
        region.regionType === RegionType.Country ||
        region.regionType === RegionType.Other
    )
}

export function checkIsOwidContinent(region: Region): region is Continent {
    return region.regionType === RegionType.Continent
}

export function checkIsIncomeGroup(region: Region): region is IncomeGroup {
    return region.regionType === RegionType.IncomeGroup
}

export function checkHasMembers(
    region?: Region
): region is Aggregate | Continent | IncomeGroup {
    return region !== undefined && "members" in region
}

export const countries: Country[] = regions.filter(
    (entity) =>
        entity.regionType === RegionType.Country &&
        !entity.isUnlisted &&
        !entity.isHistorical
) as Country[]

export const listedRegionsNames = lazy(() =>
    regions
        .filter((entity) => !checkIsCountry(entity) || !entity.isUnlisted)
        .map((entity) => entity.name)
)

export const mappableCountries: Country[] = regions.filter(
    (country): country is Country =>
        checkIsCountry(country) && !!country.isMappable
)

export const getOthers = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === RegionType.Other
        ) as Country[]
)

export const getAggregates = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === RegionType.Aggregate
        ) as Aggregate[]
)

export const getContinents = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === RegionType.Continent
        ) as Continent[]
)

export const getIncomeGroups = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === RegionType.IncomeGroup
        ) as IncomeGroup[]
)

const regionsByName = lazy(() =>
    Object.fromEntries(regions.map((region) => [region.name, region]))
)

const regionsByCode = lazy(() =>
    Object.fromEntries(regions.map((region) => [region.code, region]))
)

export const countriesByName = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.name, country]))
)

export const incomeGroupsByName = lazy(
    () =>
        Object.fromEntries(
            regions
                .filter((region) => checkIsOwidIncomeGroupName(region.code))
                .map((region) => [region.code, region])
        ) as Record<OwidIncomeGroupName, IncomeGroup>
)

const countriesBySlug = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.slug, country]))
)

/**
 * Lazy-loaded map of region names to their parent regions.
 *
 * This creates a reverse lookup from child regions to all the parent regions
 * that contain them. For example, if "France" is a member of both "Europe"
 * and "European Union", then parentRegions.get("France") would return
 * both regions.
 */
const parentRegions = lazy(() => {
    const parentRegions = new Map<string, Region[]>()
    for (const region of regions) {
        // Only process regions that can contain other regions
        if (!checkHasMembers(region)) continue

        for (const memberCode of region.members) {
            const subRegion = getRegionByCode(memberCode)
            if (!subRegion) continue
            if (!parentRegions.has(subRegion.name))
                parentRegions.set(subRegion.name, [])
            parentRegions.get(subRegion.name)!.push(region)
        }
    }
    return parentRegions
})

/**
 * Get all parent regions that contain the specified region as a member.
 *
 * For example, France's parent regions are 'Europe', 'European Union',
 * 'High-income countries', etc.
 */
export const getParentRegions = (regionName: string): Region[] => {
    return parentRegions().get(regionName) ?? []
}

/**
 * Get all sibling regions that share the same parent(s) as the specified region.
 *
 * For example, returns other European countries for 'Germany' or other
 * continents for 'Europe'.
 */
export const getSiblingRegions = (regionName: string): Region[] => {
    const parentRegions = getParentRegions(regionName)
    const siblingCodes = _.uniq(
        parentRegions.flatMap((region) =>
            checkHasMembers(region) ? region.members : []
        )
    )
    return siblingCodes
        .map(getRegionByCode)
        .filter((region) => region && region.name !== regionName) as Region[]
}

const getCountryNamesForRegionRecursive = (region: Region): string[] => {
    if (!checkHasMembers(region)) return [region.name]
    return region.members.reduce<string[]>((countryNames, memberCode) => {
        const subRegion = getRegionByCode(memberCode)
        if (!subRegion) return countryNames
        return [
            ...countryNames,
            ...getCountryNamesForRegionRecursive(subRegion),
        ]
    }, [])
}

export const getCountryNamesForRegion = (
    region: Exclude<Region, Country>
): string[] => {
    return getCountryNamesForRegionRecursive(region)
}

const regionsByNameOrVariantNameLowercase = lazy(
    () =>
        new Map(
            regions.flatMap((region) => {
                const names = [region.name.toLowerCase()]
                if ("variantNames" in region && region.variantNames) {
                    names.push(
                        ...region.variantNames.map((variant) =>
                            variant.toLowerCase()
                        )
                    )
                }
                return names.map((name) => [name, region])
            })
        )
)

const currentAndHistoricalCountryNames = lazy(() =>
    regions
        .filter(({ regionType }) => regionType === RegionType.Country)
        .map(({ name }) => name.toLowerCase())
)

export const isCountryName = (name: string): boolean =>
    currentAndHistoricalCountryNames().includes(name.toLowerCase())

export const getCountryByName = (name: string): Country | undefined =>
    countriesByName()[name]

export const getCountryBySlug = (slug: string): Country | undefined =>
    countriesBySlug()[slug]

export const getRegionByName = (name: string): Region | undefined =>
    regionsByName()[name]

const getRegionByCode = (code: string): Region | undefined =>
    regionsByCode()[code]

export const getRegionByNameOrVariantName = (
    nameOrVariantName: string
): Region | undefined =>
    regionsByNameOrVariantNameLowercase().get(nameOrVariantName.toLowerCase())

const _IntlDisplayNamesInstances = new Map<string, Intl.DisplayNames>()
const getRegionTranslation = (
    regionCode: string,
    languageCode: string
): string | undefined => {
    try {
        if (!_IntlDisplayNamesInstances.has(languageCode)) {
            _IntlDisplayNamesInstances.set(
                languageCode,
                new Intl.DisplayNames([languageCode], {
                    type: "region",
                    fallback: "none",
                })
            )
        }
        return _IntlDisplayNamesInstances.get(languageCode)!.of(regionCode)
    } catch {
        return undefined
    }
}

const _regionAlternativeNames = new Map<string, string[] | undefined>()
export const getRegionAlternativeNames = (
    regionName: string,
    languages: readonly string[]
): string[] | undefined => {
    if (!_regionAlternativeNames.has(regionName)) {
        const region = getRegionByNameOrVariantName(regionName)
        if (region) {
            const names = new Set<string>()
            if ("variantNames" in region && region.variantNames) {
                for (const variant of region.variantNames) {
                    names.add(variant)
                }
            }

            const codesForTranslation =
                ("translationCodes" in region && region.translationCodes) ||
                ("shortCode" in region && region.shortCode)
            if (codesForTranslation) {
                const translations = languages
                    .flatMap((lang) => {
                        if (Array.isArray(codesForTranslation))
                            return codesForTranslation.map((code) =>
                                getRegionTranslation(code, lang)
                            )
                        else
                            return getRegionTranslation(
                                codesForTranslation,
                                lang
                            )
                    })
                    .filter((name) => name !== undefined)

                translations.forEach((translation) => names.add(translation))
            }
            _regionAlternativeNames.set(regionName, Array.from(names))
        } else {
            _regionAlternativeNames.set(regionName, undefined)
        }
    }
    return _regionAlternativeNames.get(regionName)!
}
