import entities from "./regions.json"
import { lazy } from "./Util.js"

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
    members: string[]
}

export interface IncomeGroup {
    name: string
    regionType: "income_group"
    code: string
    members: string[]
    variantNames?: string[]
}

export interface Continent {
    name:
        | "Africa"
        | "Asia"
        | "Europe"
        | "North America"
        | "Oceania"
        | "South America"
    regionType: "continent"
    code: string
    members: string[]
}

export type Region = Country | Aggregate | IncomeGroup | Continent

export const regions: Region[] = entities as Region[]

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

export const getIncomeGroups = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === "income_group"
        ) as IncomeGroup[]
)

export const getContinents = lazy(
    () =>
        entities.filter(
            (entity) => entity.regionType === "continent"
        ) as Continent[]
)

const countriesByName = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.name, country]))
)

const countriesBySlug = lazy(() =>
    Object.fromEntries(countries.map((country) => [country.slug, country]))
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
