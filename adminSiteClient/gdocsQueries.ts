import { useContext } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DbChartTagJoin, OwidGdocIndexItem } from "@ourworldindata/utils"
import { AdminAppContext } from "./AdminAppContext.js"
import { fetchGdocs, updateGdocTags } from "./gdocsApi.js"
import { tagKeys } from "./tagQueries.js"

export const gdocKeys = {
    all: ["gdocs"] as const,
    list: () => [...gdocKeys.all, "list"] as const,
    publishedTopicSlugs: () =>
        [...gdocKeys.all, "publishedTopicSlugs"] as const,
}

export function useGdocs() {
    const { admin } = useContext(AdminAppContext)
    return useQuery({
        queryKey: gdocKeys.list(),
        queryFn: () => fetchGdocs(admin),
    })
}

export function usePublishedGdocTopicSlugs() {
    const { admin } = useContext(AdminAppContext)
    return useQuery({
        queryKey: gdocKeys.publishedTopicSlugs(),
        queryFn: async () => {
            const { slugs } = await admin.getJSON<{ slugs: string[] }>(
                "/api/gdocs/publishedTopicSlugs"
            )
            return slugs
        },
    })
}

export function useUpdateGdocTags() {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            gdocId,
            tags,
        }: {
            gdocId: string
            tags: DbChartTagJoin[]
        }) => {
            await updateGdocTags(
                admin,
                gdocId,
                tags.map((tag) => tag.id)
            )
            return { gdocId, tags }
        },
        onSuccess: async ({ gdocId, tags }) => {
            queryClient.setQueryData<OwidGdocIndexItem[]>(
                gdocKeys.list(),
                (gdocs) =>
                    gdocs?.map((gdoc) =>
                        gdoc.id === gdocId ? { ...gdoc, tags } : gdoc
                    )
            )

            await queryClient.invalidateQueries({
                queryKey: tagKeys.details(),
            })
        },
    })
}
