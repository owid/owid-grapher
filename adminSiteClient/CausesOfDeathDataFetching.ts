import { QueryStatus, useQuery, useQueryClient } from "@tanstack/react-query"
import {
    CausesOfDeathEntityData,
    CausesOfDeathMetadata,
    DataRow,
} from "./CausesOfDeathConstants"
import { fetchJson } from "@ourworldindata/utils"
import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { useEffect } from "react"

const getDataPaths = (ageGroup: "all-ages" | "under-5") => {
    if (ageGroup === "under-5") {
        return {
            metadata: "/children-under-5-deaths.metadata.json",
            data: "/children-under-5-deaths.{entityId}.data.json",
        }
    } else {
        return {
            metadata: "/causes-of-death.metadata.json",
            data: "/causes-of-death.{entityId}.data.json",
        }
    }
}

const queryKeys = {
    metadata: (ageGroup: "all-ages" | "under-5") => [
        "causes-of-death",
        ageGroup,
        "metadata",
    ],
    data: (entityId: number, ageGroup: "all-ages" | "under-5") => [
        "causes-of-death",
        ageGroup,
        "data",
        entityId,
    ],
}

export const useCausesOfDeathMetadata = (
    ageGroup: "all-ages" | "under-5" = "under-5"
): {
    data?: MyCausesOfDeathMetadata
    status: QueryStatus
    isPlaceholderData: boolean
    isFetching: boolean
} => {
    const paths = getDataPaths(ageGroup)

    const result = useQuery({
        queryKey: queryKeys.metadata(ageGroup),
        queryFn: () => fetchJson<CausesOfDeathMetadata>(paths.metadata),
        // Keep previous metadata while fetching new metadata
        placeholderData: (previousData) => previousData,
        staleTime: 5 * 60 * 1000, // Consider metadata fresh for 5 minutes
    })

    const data = result.data
        ? new MyCausesOfDeathMetadata(result.data)
        : undefined

    return {
        data: data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
        isFetching: result.isFetching,
    }
}

/** Fetch data for a specific entity */
export const useCausesOfDeathEntityData = (
    entityName: string,
    metadata: MyCausesOfDeathMetadata | undefined,
    ageGroup: "all-ages" | "under-5" = "under-5"
) => {
    const entityId = metadata?.entityNameToId.get(entityName)
    const paths = getDataPaths(ageGroup)

    const result = useQuery({
        queryKey: queryKeys.data(entityId!, ageGroup),
        queryFn: async (): Promise<CausesOfDeathEntityData> => {
            const path = paths.data.replace("{entityId}", entityId!.toString())
            return fetchJson<CausesOfDeathEntityData>(path)
        },
        enabled: entityId !== undefined,
        // Keep previous data while fetching new data
        placeholderData: (previousData) => previousData,
    })

    const data =
        metadata && result.data
            ? parseEntityData(entityName, result.data, metadata)
            : undefined

    return {
        data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
        isFetching: result.isFetching,
    }
}

/**
 * Prefetch metadata for both age groups to improve switching UX
 */
export const usePrefetchCausesOfDeathMetadata = () => {
    const queryClient = useQueryClient()

    useEffect(() => {
        const ageGroups: ("all-ages" | "under-5")[] = ["all-ages", "under-5"]

        ageGroups.forEach((ageGroup) => {
            const paths = getDataPaths(ageGroup)
            void queryClient.prefetchQuery({
                queryKey: queryKeys.metadata(ageGroup),
                queryFn: () => fetchJson<CausesOfDeathMetadata>(paths.metadata),
                staleTime: 5 * 60 * 1000, // Consider metadata fresh for 5 minutes
            })
        })
    }, [queryClient])
}

export const parseEntityData = (
    entityName: string,
    entityData: CausesOfDeathEntityData,
    metadata: MyCausesOfDeathMetadata
): DataRow[] => {
    return entityData.values
        .map((value, index) => {
            const variableId = entityData.variables[index]
            const year = entityData.years[index]

            const variable = metadata.variableById.get(variableId)?.name
            if (!variable) return null

            // TODO
            // if (!isCauseOfDeathIndicatorName(variable)) {
            //     console.warn(`Unknown variable name: ${variable}`)
            //     return null
            // }

            return { entityName, year, variable, value, share: 0 } // TODO: share?
        })
        .filter((item) => item !== null)
}
