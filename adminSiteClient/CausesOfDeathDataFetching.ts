import { QueryStatus, useQuery } from "@tanstack/react-query"
import {
    CausesOfDeathEntityData,
    CausesOfDeathMetadata,
    DataRow,
    isCauseOfDeathIndicatorName,
} from "./CausesOfDeathConstants"
import { fetchJson } from "@ourworldindata/utils"
import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"

export const CAUSES_OF_DEATH_METADATA_PATH = "/causes-of-death.metadata.json"
export const CAUSES_OF_DEATH_DATA_PATH_TEMPLATE =
    "/causes-of-death.{entityId}.data.json"

const queryKeys = {
    metadata: () => ["causes-of-death", "metadata"],
    data: (entityId: number) => ["causes-of-death", "data", entityId],
}

export const useCausesOfDeathMetadata = (): {
    data?: MyCausesOfDeathMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () =>
            fetchJson<CausesOfDeathMetadata>(CAUSES_OF_DEATH_METADATA_PATH),
    })

    const data = result.data
        ? new MyCausesOfDeathMetadata(result.data)
        : undefined

    console.log("fetched", result.data, data)

    return { data: data, status: result.status }
}

/** Fetch data for a specific entity */
export const useCausesOfDeathEntityData = (
    entityName: string,
    metadata: MyCausesOfDeathMetadata | undefined
) => {
    const entityId = metadata?.entityNameToId.get(entityName)

    const result = useQuery({
        queryKey: queryKeys.data(entityId!),
        queryFn: async (): Promise<CausesOfDeathEntityData> => {
            const path = CAUSES_OF_DEATH_DATA_PATH_TEMPLATE.replace(
                "{entityId}",
                entityId!.toString()
            )
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

            if (!isCauseOfDeathIndicatorName(variable)) {
                console.warn(`Unknown variable name: ${variable}`)
                return null
            }

            return { entityName, year, variable, value }
        })
        .filter((item) => item !== null)
}
