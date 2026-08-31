import { QueryStatus, useQuery } from "@tanstack/react-query"
import { BespokeMetadata } from "@ourworldindata/types"
import { DataJson, MetadataJson, DataRow } from "./CausesOfDeathConstants"
import { fetchJson } from "@ourworldindata/utils"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"

const BASE_URL = "https://owid-public.owid.io/data/gbd"
const METADATA_PATH = BASE_URL + "/causes-of-death.metadata.json"
const DATA_PATH = BASE_URL + "/causes-of-death.{entityId}.json"

// Provenance the metadata file will eventually carry itself, kept in a
// hand-written file next to it until the ETL writes those fields
const BESPOKE_METADATA_PATH =
    "https://owid-public.owid.io/sophia-test/causes-of-death.bespoke-metadata.test.json"

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
        queryFn: async (): Promise<MetadataJson> => {
            const [metadata, bespokeMetadata] = await Promise.all([
                fetchJson<MetadataJson>(METADATA_PATH),
                fetchJson<BespokeMetadata>(BESPOKE_METADATA_PATH),
            ])
            return { ...metadata, ...bespokeMetadata }
        },
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
    const unknownEntity = metadata !== undefined && entityId === undefined

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

    if (unknownEntity) {
        console.error(`Unknown entity: "${entityName}"`)
        return {
            data: undefined,
            status: "error",
            isPlaceholderData: false,
            isFetching: false,
        }
    }

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

// Descriptions for "Children under 5" that override the metadata.
// Temporary hot-fix until the metadata is updated.
const UNDER_5_DESCRIPTIONS: Record<string, string> = {
    "Other infectious diseases": "Typhoid, hepatitis, encephalitis and others",
    "Other non-communicable diseases":
        "Cardiovascular diseases, digestive diseases, genetic blood disorders, and others",
    "Other injuries": "Animal contact, forces of nature and others",
}

const parseEntityData = ({
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
            const sexId = entityData.sexes[index]

            const ageGroupMetadata = metadata.ageGroupById.get(ageGroupId)
            if (!ageGroupMetadata) {
                console.warn(`Unknown age group ID: ${ageGroupId}`)
                return null
            }

            const sexMetadata = metadata.sexById.get(sexId)
            if (!sexMetadata) {
                console.warn(`Unknown sex ID: ${sexId}`)
                return null
            }

            const variableMetadata = metadata.variableById.get(variableId)
            if (!variableMetadata) {
                console.warn(`Unknown variable ID: ${variableId}`)
                return null
            }

            const categoryId = variableMetadata.category
            const categoryMetadata = metadata.categoryById.get(categoryId)
            if (!categoryMetadata) {
                console.warn(`Unknown category ID: ${categoryId}`)
                return null
            }

            const description =
                (ageGroupMetadata.name === "Children under 5"
                    ? UNDER_5_DESCRIPTIONS[variableMetadata.name]
                    : undefined) ?? variableMetadata.description

            return {
                entityName,
                year,
                variable: variableMetadata.name,
                description,
                ageGroup: ageGroupMetadata.name,
                sex: sexMetadata.name,
                category: categoryMetadata.name,
                value,
            }
        })
        .filter((item) => item !== null)
}
