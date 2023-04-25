import entities from "./regions.json"

export interface Country {
    code: string
    shortCode?: string
    name: string
    shortName?: string
    slug: string
    regionType?: "country" | "other"
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
    (entity: any) =>
        entity.regionType === "country" &&
        !entity.isUnlisted &&
        !entity.isHistorical
) as Country[]

export const others: Country[] = entities.filter(
    (entity: any) => entity.regionType === "other"
) as Country[]

export const aggregates: Aggregate[] = entities.filter(
    (entity: any) => entity.regionType === "aggregate"
) as Aggregate[]

export const continents: Continent[] = entities.filter(
    (entity: any) => entity.regionType === "continent"
) as Continent[]

export const getCountry = (slug: string): Country | undefined =>
    countries.find((c) => c.slug === slug)

export const getCountryDetectionRedirects = (): string[] =>
    countries
        .filter((country) => country.shortCode && country.code)
        .map(
            (country) =>
                `/detect-country-redirect /detect-country.js?${
                    country.code
                } 302! Country=${country.shortCode!.toLowerCase()}`
        )
