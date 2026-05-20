import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson, UserCountryInformation } from "@ourworldindata/utils"
import { CountryData, DemographyMetadata } from "./types"
import { combineStatuses } from "./utils.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

const BASE_URL = "https://owid-public.owid.io/bespoke/demography"
const METADATA_PATH = BASE_URL + "/demography.metadata.json"
const DATA_PATH = BASE_URL + "/demography.{countrySlug}.data.json"
const LIFE_EXPECTANCY_AT_DIFFERENT_AGES_CSV_URL =
    "https://ourworldindata.org/grapher/life-expectancy-at-different-ages.csv?v=1&csvType=full&useColumnShortNames=true"

export const queryClient = new QueryClient()

const queryKeys = {
    metadata: () => ["demography", "metadata"],
    data: (slug: string) => ["demography", "data", slug],
    lifeExpectancyAtDifferentAges: () => [
        "demography",
        "lifeExpectancyAtDifferentAges",
    ],
    location: () => ["location"],
}

export interface LifeExpectancyAtDifferentAgesPoint {
    year: number
    atAge0: number
    atAge65: number
}

type LifeExpectancyAtDifferentAgesByEntity = Record<
    string,
    LifeExpectancyAtDifferentAgesPoint[]
>

function parseCsvLine(line: string): string[] {
    const values: string[] = []
    const quote = String.fromCharCode(34)
    let value = ""
    let isInQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]
        if (char === quote && isInQuotes && nextChar === quote) {
            value += quote
            i++
        } else if (char === quote) {
            isInQuotes = !isInQuotes
        } else if (char === "," && !isInQuotes) {
            values.push(value)
            value = ""
        } else {
            value += char
        }
    }

    values.push(value)
    return values
}

function parseLifeExpectancyAtDifferentAgesCsv(
    csv: string
): LifeExpectancyAtDifferentAgesByEntity {
    const [headerLine, ...dataLines] = csv.trim().split(/\r?\n/)
    const headers = parseCsvLine(headerLine)
    const entityIndex = headers.indexOf("entity")
    const yearIndex = headers.indexOf("year")
    const atAge0Index = headers.indexOf("life_expectancy_0")
    const atAge65Index = headers.indexOf("life_expectancy__sex_total__age_65")
    const pointsByEntity: LifeExpectancyAtDifferentAgesByEntity = {}

    for (const line of dataLines) {
        if (!line) continue
        const row = parseCsvLine(line)
        const entity = row[entityIndex]
        const year = Number(row[yearIndex])
        const atAge0 = Number(row[atAge0Index])
        const atAge65 = Number(row[atAge65Index])
        if (
            !entity ||
            !Number.isFinite(year) ||
            !Number.isFinite(atAge0) ||
            !Number.isFinite(atAge65)
        )
            continue

        pointsByEntity[entity] ??= []
        pointsByEntity[entity].push({ year, atAge0, atAge65 })
    }

    for (const points of Object.values(pointsByEntity)) {
        points.sort((a, b) => a.year - b.year)
    }

    return pointsByEntity
}

/** Fetch demography metadata */
export const useDemographyMetadata = (): {
    data?: DemographyMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<DemographyMetadata>(METADATA_PATH),
    })

    return { data: result.data, status: result.status }
}

/** Fetch demography data for a specific entity */
export const useDemographyEntityData = (
    entityName: string,
    metadata?: DemographyMetadata
): {
    data?: CountryData
    status: QueryStatus
    isPlaceholderData: boolean
    isFetching: boolean
} => {
    const entitySlug = metadata?.slugs[entityName]
    const hasUnknownEntity = metadata !== undefined && entitySlug === undefined

    const result = useQuery({
        queryKey: queryKeys.data(entitySlug!),
        queryFn: async (): Promise<CountryData> => {
            const path = DATA_PATH.replace(
                "{countrySlug}",
                entitySlug!.toString()
            )
            return fetchJson<CountryData>(path)
        },
        enabled: entitySlug !== undefined,
        // Keep previous data while fetching new data
        placeholderData: (previousData) => previousData,
    })

    return {
        data: result.data,
        status: hasUnknownEntity ? "error" : result.status,
        isPlaceholderData: result.isPlaceholderData,
        isFetching: result.isFetching,
    }
}

/** Combined hook for loading demography metadata + entity data */
export function useDemographyData(entityName: string): {
    metadata?: DemographyMetadata
    entityData?: CountryData
    isLoadingEntityData: boolean
    status: QueryStatus
} {
    const metadataResponse = useDemographyMetadata()
    const entityDataResponse = useDemographyEntityData(
        entityName,
        metadataResponse.data
    )
    const isLoadingEntityData = useDelayedLoading(
        entityDataResponse.isPlaceholderData,
        300
    )
    const status = combineStatuses(
        metadataResponse.status,
        entityDataResponse.status
    )
    return {
        metadata: metadataResponse.data,
        entityData: entityDataResponse.data,
        isLoadingEntityData,
        status,
    }
}

export function useLifeExpectancyAtDifferentAges(entityName: string): {
    data?: LifeExpectancyAtDifferentAgesPoint[]
    status: QueryStatus
} {
    const result = useQuery({
        queryKey: queryKeys.lifeExpectancyAtDifferentAges(),
        queryFn: async (): Promise<LifeExpectancyAtDifferentAgesByEntity> => {
            const response = await fetch(
                LIFE_EXPECTANCY_AT_DIFFERENT_AGES_CSV_URL
            )
            if (!response.ok)
                throw new Error(
                    `Failed to fetch life expectancy at different ages: ${response.status}`
                )
            return parseLifeExpectancyAtDifferentAgesCsv(await response.text())
        },
    })

    return { data: result.data?.[entityName], status: result.status }
}

export function useUserCountryInformation(): { data?: UserCountryInformation } {
    const result = useQuery({
        queryKey: queryKeys.location(),
        queryFn: async () => {
            const response = await fetchJson<{
                country: UserCountryInformation
            }>("https://ourworldindata.org/api/detect-country")
            return response.country
        },
    })

    return result
}
