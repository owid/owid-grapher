import { useMemo } from "react"
import { QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson } from "@ourworldindata/utils"
import { BespokeMetadata } from "@ourworldindata/types"

import { parseBespokeMetadata } from "../../../../components/MetadataModal/bespokeMetadata.js"
import {
    ConflictTypeMetadata,
    DataJson,
    DataRow,
    MetadataJson,
} from "./ConflictDeathsConstants.js"
import { ConflictDeathsMetadata } from "./ConflictDeathsMetadata.js"

const queryKeys = {
    metadata: () => ["conflict-deaths", "metadata"],
    data: (conflictTypeId: number) => [
        "conflict-deaths",
        "data",
        conflictTypeId,
    ],
}

/** Fetch the metadata: regions, countries, conflict types and sources */
export const useConflictDeathsMetadata = (
    metadataUrl: string
): {
    data?: ConflictDeathsMetadata
    bespokeMetadata?: BespokeMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<MetadataJson>(metadataUrl),
        staleTime: Infinity,
    })

    // Memoized, so the lookup maps are built once and consumers' memos hold
    const data = useMemo(
        () =>
            result.data ? new ConflictDeathsMetadata(result.data) : undefined,
        [result.data]
    )
    const bespokeMetadata = useMemo(
        () => (result.data ? parseBespokeMetadata(result.data) : undefined),
        [result.data]
    )

    return { data, bespokeMetadata, status: result.status }
}

/** Fetch the deaths in all countries and years for one conflict type */
export const useConflictDeathsData = (
    conflictType: ConflictTypeMetadata | undefined,
    metadata: ConflictDeathsMetadata | undefined,
    dataUrl: string
): {
    data?: DataRow[]
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const conflictTypeId = conflictType?.id
    const url = `${dataUrl}/conflict-deaths.${conflictTypeId}.json`

    const result = useQuery({
        queryKey: queryKeys.data(conflictTypeId!),
        queryFn: () => fetchJson<DataJson>(url),
        enabled: conflictTypeId !== undefined,
        staleTime: Infinity,
        // Keep previous data while fetching new data
        placeholderData: (previousData) => previousData,
    })

    const data = useMemo(
        () =>
            metadata && result.data
                ? parseData({ data: result.data, metadata })
                : undefined,
        [metadata, result.data]
    )

    return {
        data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
    }
}

const parseData = ({
    data,
    metadata,
}: {
    data: DataJson
    metadata: ConflictDeathsMetadata
}): DataRow[] => {
    return data.values
        .map((value, index) => {
            const entityId = data.entities[index]
            const year = data.years[index]

            const entity = metadata.entityById.get(entityId)
            if (!entity) {
                console.warn(`Unknown entity ID: ${entityId}`)
                return null
            }

            const region = metadata.regionById.get(entity.region)
            if (!region) {
                console.warn(`Unknown region ID: ${entity.region}`)
                return null
            }

            return { entityName: entity.name, year, region: region.name, value }
        })
        .filter((row) => row !== null)
}
