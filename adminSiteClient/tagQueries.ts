import { useContext } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
    DbChartTagJoin,
    MinimalTagWithMetadata,
    OwidGdocIndexItem,
    TaggableType,
} from "@ourworldindata/utils"
import type { ChartListItem } from "./ChartList.js"
import type { DatasetListItem } from "./DatasetList.js"
import { AdminAppContext } from "./AdminAppContext.js"

export interface TagPageData {
    id: number
    name: string
    specialType?: string
    updatedAt: string
    datasets: DatasetListItem[]
    charts: ChartListItem[]
    gdocs: OwidGdocIndexItem[]
    children: MinimalTagWithMetadata[]
    slug: string | null
    searchableInAlgolia: boolean
}

export interface TagDetailResponse {
    tag: TagPageData
}

export const tagKeys = {
    all: ["tags"] as const,
    list: () => [...tagKeys.all, "list"] as const,
    details: () => [...tagKeys.all, "detail"] as const,
    detail: (tagId: number) => [...tagKeys.details(), tagId] as const,
}

export function useTag(tagId: number) {
    const { admin } = useContext(AdminAppContext)
    return useQuery({
        queryKey: tagKeys.detail(tagId),
        queryFn: () =>
            admin.getJSON<TagDetailResponse>(`/api/tags/${tagId}.json`),
    })
}

export function useTags() {
    const { admin } = useContext(AdminAppContext)
    return useQuery({
        queryKey: tagKeys.list(),
        queryFn: async () => {
            const { tags } = await admin.getJSON<{
                tags: MinimalTagWithMetadata[]
            }>("/api/tags.json")
            return tags
        },
    })
}

export function useSuggestTags() {
    const { admin } = useContext(AdminAppContext)

    return useMutation({
        mutationFn: ({ type, id }: { type: TaggableType; id: number }) =>
            admin.getJSON<Record<"topics", DbChartTagJoin[]>>(
                `/api/gpt/suggest-topics/${type}/${id}.json`
            ),
    })
}

export function useAddTag() {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            name,
            slug,
        }: {
            name: string
            slug: string | null
        }) => {
            await admin.requestJSON("/api/tags/new", { name, slug }, "POST")
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: tagKeys.list(),
            })
        },
    })
}
