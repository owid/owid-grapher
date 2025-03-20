import entities from "./regions.json"
import { excludeUndefined, lazy } from "./Util.js"

export enum RegionType {
    Country = "country",
    Other = "other",
    Aggregate = "aggregate",
    Continent = "continent",
    IncomeGroup = "income_group",
}

export interface Country {
    code: string
    shortCode?: string
    name: string
    shortName?: string
    slug: string
    regionType: "country" | "other"
    isMappable?: boolean
    isHistorical?: boolean
    isUnlisted?: boolean
    variantNames?: string[]
}

export interface Aggregate {
    name: string
    regionType: "aggregate"
    code: string
    translationCodes?: string[]
    members: string[]
}

export interface Continent {
    name:
        | "Africa"
        | "Asia"
        | "Europe"
        | "North America"
        | "Oceania"
        | "South America"
    regionType: "continent" | "income_group"
    code: string
    translationCodes?: string[]
    members: string[]
}

export type Region = Country | Aggregate | Continent

export const regions: Region[] = entities as Region[]

export const regionsByName = lazy(() =>
    Object.fromEntries(regions.map((region) => [region.name, region]))
)

export const countries: Country[] = regions.filter(
    (entity) =>
        entity.regionType === "country" &&
        !entity.isUnlisted &&
        !entity.isHistorical
) as Country[]

export const getOthers = lazy(
    () =>
        entities.filter((entity) => entity.regionType === "other") as Country[]
)

export const getAggregates = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === "aggregate"
        ) as Aggregate[]
)

export const getContinents = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === "continent"
        ) as Continent[]
)

export const getIncomeGroups = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === "income_group"
        ) as Continent[]
)

export const getMemberCountries = (regionName: string): string[] => {
    const region = regionsByName()[regionName]
    if (!region) return []
    if (region.code === "OWID_WRL") return []
    if (!isContinent(region) && !isAggregate(region)) return []
    return excludeUndefined(
        region.members.map(
            (countryCode) => countriesByCode()[countryCode]?.name
        )
    )
}

export const countriesByName = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.name, country]))
)

export const countriesByCode = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.code, country]))
)

const countriesBySlug = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.slug, country]))
)

const isContinent = (region: Region): region is Continent =>
    region.regionType === "continent" || region.regionType === "income_group"
const isAggregate = (region: Region): region is Aggregate =>
    region.regionType === "aggregate"

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
        .filter(({ regionType }) => regionType === "country")
        .map(({ name }) => name.toLowerCase())
)

export const isCountryName = (name: string): boolean =>
    currentAndHistoricalCountryNames().includes(name.toLowerCase())

export const getCountryByName = (name: string): Country | undefined =>
    countriesByName()[name]

export const getCountryBySlug = (slug: string): Country | undefined =>
    countriesBySlug()[slug]

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
