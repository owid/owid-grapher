import { useContext } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { DbChartTagJoin } from "@ourworldindata/utils"
import { AdminAppContext } from "./AdminAppContext.js"
import { tagKeys } from "./tagQueries.js"

export interface DatasetListItem {
    id: number
    name: string
    // The tag page's datasets come without these three, and a dataset no
    // chart uses has no chart count
    shortName?: string | null
    namespace: string
    description: string
    dataEditedAt: Date
    dataEditedByUserName: string
    metadataEditedAt: Date
    metadataEditedByUserName: string
    tags: DbChartTagJoin[]
    isPrivate: boolean
    nonRedistributable: boolean
    version?: string | null
    numCharts?: number | null
}

export const datasetKeys = {
    all: ["datasets"] as const,
    list: () => [...datasetKeys.all, "list"] as const,
}

export function useDatasets() {
    const { admin } = useContext(AdminAppContext)
    return useQuery({
        queryKey: datasetKeys.list(),
        queryFn: async () => {
            const { datasets } = await admin.getJSONInBackground<{
                datasets: DatasetListItem[]
            }>("/api/datasets.json")
            return datasets
        },
    })
}

export function useSetDatasetTags() {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            datasetId,
            tags,
        }: {
            datasetId: number
            tags: DbChartTagJoin[]
        }) =>
            admin.requestJSON(
                `/api/datasets/${datasetId}/setTags`,
                { tagIds: tags.map((t) => t.id) },
                "POST"
            ),
        onSuccess: async () => {
            // Datasets are listed both on their own index page and on tag
            // pages, so refresh both.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: datasetKeys.all }),
                queryClient.invalidateQueries({ queryKey: tagKeys.all }),
            ])
        },
    })
}
