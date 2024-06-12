import entities from "./regions.json"

export enum RegionType {
    Country = "country",
    Other = "other",
    Aggregate = "aggregate",
    Continent = "continent",
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

export type Region = Country | Aggregate | Continent

export const regions: Region[] = entities as Region[]

export const countries: Country[] = regions.filter(
    (entity) =>
        entity.regionType === "country" &&
        !entity.isUnlisted &&
        !entity.isHistorical
) as Country[]

export const others: Country[] = entities.filter(
    (entity) => entity.regionType === "other"
) as Country[]

export const aggregates: Aggregate[] = entities.filter(
    (entity) => entity.regionType === "aggregate"
) as Aggregate[]

export const continents: Continent[] = entities.filter(
    (entity) => entity.regionType === "continent"
) as Continent[]

const countriesByName: Record<string, Country> = Object.fromEntries(
    countries.map((country) => [country.name, country])
)

const countriesBySlug: Record<string, Country> = Object.fromEntries(
    countries.map((country) => [country.slug, country])
)

const regionsByNameOrVariantNameLowercase: Map<string, Region> = new Map(
    regions.flatMap((region) => {
        const names = [region.name.toLowerCase()]
        if ("variantNames" in region && region.variantNames) {
            names.push(
                ...region.variantNames.map((variant) => variant.toLowerCase())
            )
        }
        return names.map((name) => [name, region])
    })
)

const currentAndHistoricalCountryNames = regions
    .filter(({ regionType }) => regionType === "country")
    .map(({ name }) => name.toLowerCase())

export const isCountryName = (name: string): boolean =>
    currentAndHistoricalCountryNames.includes(name.toLowerCase())

export const getCountryByName = (name: string): Country | undefined =>
    countriesByName[name]

export const getCountryBySlug = (slug: string): Country | undefined =>
    countriesBySlug[slug]

export const getRegionByNameOrVariantName = (
    nameOrVariantName: string
): Region | undefined =>
    regionsByNameOrVariantNameLowercase.get(nameOrVariantName.toLowerCase())
