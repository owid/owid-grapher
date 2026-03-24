import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson, UserCountryInformation } from "@ourworldindata/utils"
import { CountryData, DemographyMetadata } from "./types"
import { combineStatuses } from "./utils.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

const BASE_URL = "https://owid-public.owid.io/population-simulation-2026-03"
const METADATA_PATH = BASE_URL + "/population-simulation.metadata.json"
const DATA_PATH = BASE_URL + "/population-simulation.{countrySlug}.data.json"

export const queryClient = new QueryClient()

const queryKeys = {
    metadata: () => ["demography", "metadata"],
    data: (slug: string) => ["demography", "data", slug],
    location: () => ["location"],
}

/** Fetch demography metadata */
export const useDemographyMetadata = (): {
    data?: DemographyMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () =>
            fetchJson<DemographyMetadata>(METADATA_PATH + "?nocache"),
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

    const result = useQuery({
        queryKey: queryKeys.data(entitySlug!),
        queryFn: async (): Promise<CountryData> => {
            const path =
                DATA_PATH.replace("{countrySlug}", entitySlug!.toString()) +
                "?nocache"
            return fetchJson<CountryData>(path)
        },
        enabled: entitySlug !== undefined,
        // Keep previous data while fetching new data
        placeholderData: (previousData) => previousData,
    })

    return {
        data: result.data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
        isFetching: result.isFetching,
    }
}

/** Combined hook for loading demography metadata + entity data */
export function useDemographyData(entityName: string): {
    metadata?: DemographyMetadata
    entityData?: CountryData
    isLoadingEntityData: boolean // TODO: Is this necessary?
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
