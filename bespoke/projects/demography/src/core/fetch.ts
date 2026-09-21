import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson } from "@ourworldindata/utils"
import { CountryData, DemographyMetadata } from "./types"
import { combineStatuses } from "../../../../helpers/queryStatus.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

export const queryClient = new QueryClient()

const queryKeys = {
    metadata: () => ["demography", "metadata"],
    data: (slug: string) => ["demography", "data", slug],
}

/** Fetch demography metadata */
export const useDemographyMetadata = (
    metadataUrl: string
): {
    data?: DemographyMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<DemographyMetadata>(metadataUrl),
    })

    return { data: result.data, status: result.status }
}

/** Fetch demography data for a specific entity */
export const useDemographyEntityData = (
    entityName: string,
    dataUrl: string,
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
        queryFn: async (): Promise<CountryData> =>
            fetchJson<CountryData>(
                `${dataUrl}/demography.${entitySlug}.data.json`
            ),
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
export function useDemographyData(
    entityName: string,
    urls: BespokeComponentDataUrls
): {
    metadata?: DemographyMetadata
    entityData?: CountryData
    isLoadingEntityData: boolean
    status: QueryStatus
} {
    const metadataResponse = useDemographyMetadata(urls.metadataUrl)
    const entityDataResponse = useDemographyEntityData(
        entityName,
        urls.dataUrl,
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
