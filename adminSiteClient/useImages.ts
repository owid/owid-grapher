import { useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import { DbEnrichedImageWithPageviews } from "@ourworldindata/types"
import { AdminAppContext } from "./AdminAppContext.js"

export function useImages() {
    const { admin } = useContext(AdminAppContext)

    return useQuery<DbEnrichedImageWithPageviews[]>({
        queryKey: ["images"],
        queryFn: async () => {
            const response = await admin.getJSON<{
                images: DbEnrichedImageWithPageviews[]
            }>("/api/images.json")
            return response.images
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — image list rarely changes during an editing session
    })
}
