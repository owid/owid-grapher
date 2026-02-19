import * as _ from "lodash-es"
import { EntityName } from "@ourworldindata/types"
import { lazy } from "../Util.js"
import { regions } from "./regions.js"
import type {
    Region,
    Country,
    Aggregate,
    Continent,
    IncomeGroup,
    OwidIncomeGroupCode,
    RegionDataProvider,
    AggregateWithDefinedBy,
} from "./regionsTypes.js"

export function checkIsCountry(region: Region): region is Country {
    return region.regionType === "country" || region.regionType === "other"
}

export function checkIsAggregate(region: Region): region is Aggregate {
    return region.regionType === "aggregate"
}

export function checkIsOwidContinent(region: Region): region is Continent {
    return region.regionType === "continent"
}

export function checkIsIncomeGroup(region: Region): region is IncomeGroup {
    return region.regionType === "income_group"
}

export function checkHasMembers(
    region?: Region
): region is Aggregate | Continent | IncomeGroup {
    return region !== undefined && "members" in region
}

export function checkIsOwidIncomeGroupCode(
    code: string
): code is OwidIncomeGroupCode {
    return getIncomeGroups().some((incomeGroup) => incomeGroup.code === code)
}

export const countries: Country[] = regions.filter(
    (entity): entity is Country =>
        entity.regionType === "country" &&
        !entity.isUnlisted &&
        !entity.isHistorical
)

export const mappableCountries: Country[] = regions.filter(
    (country): country is Country =>
        checkIsCountry(country) && !!country.isMappable
)

export const getContinents = lazy(() =>
    regions.filter((entity): entity is Continent =>
        checkIsOwidContinent(entity)
    )
)

export const getIncomeGroups = lazy(() =>
    regions.filter((entity): entity is IncomeGroup =>
        checkIsIncomeGroup(entity)
    )
)

export const getAggregates = lazy(() =>
    regions.filter((entity): entity is Aggregate => checkIsAggregate(entity))
)

export const listedRegionsNames = lazy(() =>
    regions
        .filter((entity) => checkIsCountry(entity) && !entity.isUnlisted)
        .map((entity) => entity.name)
)

export const getRegionDataProviders = lazy(() => [
    ...new Set(
        regions
            .filter(
                (r): r is AggregateWithDefinedBy =>
                    r.regionType === "aggregate" && "definedBy" in r
            )
            .map((r) => r.definedBy)
    ),
])

export const getAggregatesByProvider = (
    provider: RegionDataProvider
): Aggregate[] => getAggregates().filter((r) => r.definedBy === provider)

const regionsByName = lazy(() =>
    Object.fromEntries(regions.map((region) => [region.name, region]))
)

const regionsBySlug = lazy(() =>
    Object.fromEntries(regions.map((region) => [region.slug, region]))
)

const regionsByCode = lazy(() =>
    Object.fromEntries(regions.map((region) => [region.code, region]))
)

const regionsByShortName = lazy(() =>
    Object.fromEntries(
        regions
            .filter((region) => region.shortName)
            .map((region) => [region.shortName, region])
    )
)

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

export const countriesByName = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.name, country]))
)

const countriesBySlug = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.slug, country]))
)

export const incomeGroupsByCode = lazy(
    () =>
        Object.fromEntries(
            getIncomeGroups().map((region) => [region.code, region])
        ) as Record<OwidIncomeGroupCode, IncomeGroup>
)

export const getRegionByName = (name: string): Region | undefined =>
    regionsByName()[name]

export const getRegionBySlug = (slug: string): Region | undefined =>
    regionsBySlug()[slug]

export const getRegionByCode = (code: string): Region | undefined =>
    regionsByCode()[code]

export const getRegionByShortName = (shortName: string): Region | undefined =>
    regionsByShortName()[shortName]

export const getRegionByNameOrVariantName = (
    nameOrVariantName: string
): Region | undefined =>
    regionsByNameOrVariantNameLowercase().get(nameOrVariantName.toLowerCase())

export const getCountryByName = (name: string): Country | undefined =>
    countriesByName()[name]

export const getCountryBySlug = (slug: string): Country | undefined =>
    countriesBySlug()[slug]

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
        .filter(
            (region): region is Region =>
                region !== undefined && region.name !== regionName
        )
}

/**
 * Gets the OWID continent name for a country.
 * Returns undefined if the entity is not a country or has no continent.
 */
export function getContinentForCountry(
    countryName: EntityName
): string | undefined {
    const parentRegions = getParentRegions(countryName)
    const continent = parentRegions.find((r) => checkIsOwidContinent(r))
    return continent?.name
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

            const translationCodes =
                "translationCodes" in region
                    ? region.translationCodes
                    : undefined
            const shortCode =
                "shortCode" in region ? region.shortCode : undefined

            const codes = translationCodes ?? (shortCode ? [shortCode] : [])
            const translations = languages
                .flatMap((lang) =>
                    codes.map((code) => getRegionTranslation(code, lang))
                )
                .filter((name) => name !== undefined)

            translations.forEach((translation) => names.add(translation))
            _regionAlternativeNames.set(regionName, Array.from(names))
        } else {
            _regionAlternativeNames.set(regionName, undefined)
        }
    }
    return _regionAlternativeNames.get(regionName)!
}

// Regions that require the definite article "the" before their name
// Maintained here instead of in the ETL because it's such a specific piece of metadata.
const regionsWithArticles = new Set([
    "Aland Islands",
    "Netherlands Antilles",
    "United Arab Emirates",
    "French Southern Territories",
    "Bahrain",
    "Bahamas",
    "Central African Republic",
    "Cocos Islands",
    "Democratic Republic of Congo",
    "Congo",
    "Cook Islands",
    "Comoros",
    "Cayman Islands",
    "Dominican Republic",
    "Western Sahara",
    "Falkland Islands",
    "Faroe Islands",
    "United Kingdom",
    "Gambia",
    "Heard Island and McDonald Islands",
    "Isle of Man",
    "British Indian Ocean Territory",
    "Maldives",
    "Marshall Islands",
    "Northern Mariana Islands",
    "Netherlands",
    "Grand Duchy of Baden",
    "Kingdom of Bavaria",
    "Democratic Republic of Vietnam",
    "Kingdom of the Two Sicilies",
    "Duchy of Modena and Reggio",
    "Orange Free State",
    "Duchy of Parma and Piacenza",
    "Federal Republic of Central America",
    "Republic of Vietnam",
    "Kingdom of Sardinia",
    "Kingdom of Saxony",
    "Sudan (former)",
    "Grand Duchy of Tuscany",
    "USSR",
    "Kingdom of Wurttemberg",
    "Yemen Arab Republic",
    "Yemen People's Republic",
    "Philippines",
    "Gaza Strip",
    "South Georgia and the South Sandwich Islands",
    "Solomon Islands",
    "Seychelles",
    "Turks and Caicos Islands",
    "United States",
    "Vatican",
    "British Virgin Islands",
    "United States Virgin Islands",
])

export const articulateEntity = (entityName: EntityName): string => {
    return regionsWithArticles.has(entityName)
        ? `the ${entityName}`
        : entityName
}
