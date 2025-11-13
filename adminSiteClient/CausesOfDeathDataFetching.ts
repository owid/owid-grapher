import { QueryStatus, useQuery } from "@tanstack/react-query"
import { DataJson, MetadataJson, DataRow } from "./CausesOfDeathConstants"
import { fetchJson } from "@ourworldindata/utils"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"

const METADATA_PATH = "/deaths-combined.metadata.json"
const DATA_PATH = "/deaths-combined.{entityId}.data.json"

const queryKeys = {
    metadata: () => ["causes-of-death", "metadata"],
    data: (entityId: number) => ["causes-of-death", "data", entityId],
}

/** Fetch causes of death metadata */
export const useCausesOfDeathMetadata = (): {
    data?: CausesOfDeathMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<MetadataJson>(METADATA_PATH),
    })

    const data = result.data
        ? new CausesOfDeathMetadata(result.data)
        : undefined

    return { data: data, status: result.status }
}

/** Fetch causes of death data for a specific entity */
export const useCausesOfDeathEntityData = (
    entityName: string,
    metadata?: CausesOfDeathMetadata
): {
    data?: DataRow[]
    status: QueryStatus
    isPlaceholderData: boolean
    isFetching: boolean
} => {
    const entityId = metadata?.entityNameToId.get(entityName)

    const result = useQuery({
        queryKey: queryKeys.data(entityId!),
        queryFn: async (): Promise<DataJson> => {
            const path = DATA_PATH.replace("{entityId}", entityId!.toString())
            return fetchJson<DataJson>(path)
        },
        enabled: entityId !== undefined,
        // Keep previous data while fetching new data
        placeholderData: (previousData) => previousData,
    })

    const data =
        metadata && result.data
            ? parseEntityData({ entityName, entityData: result.data, metadata })
            : undefined

    return {
        data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
        isFetching: result.isFetching,
    }
}

export const parseEntityData = ({
    entityData,
    entityName,
    metadata,
}: {
    entityName: string
    entityData: DataJson
    metadata: CausesOfDeathMetadata
}): DataRow[] => {
    return entityData.values
        .map((value, index) => {
            const variableId = entityData.variables[index]
            const year = entityData.years[index]
            const ageGroupId = entityData.ageGroups[index]

            const variable = metadata.variableById.get(variableId)?.name
            if (!variable) {
                console.warn(`Unknown variable ID: ${variableId}`)
                return null
            }

            const ageGroup = metadata.ageGroupById.get(ageGroupId)?.name
            if (!ageGroup) {
                console.warn(`Unknown age group ID: ${ageGroupId}`)
                return null
            }

            return { entityName, year, variable, ageGroup, value }
        })
        .filter((item) => item !== null)
}
