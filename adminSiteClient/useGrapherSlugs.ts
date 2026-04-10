import { useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdminAppContext } from "./AdminAppContext.js"
import { ChartListItem } from "./ChartList.js"

export function useGrapherSlugs() {
    const { admin } = useContext(AdminAppContext)

    return useQuery<string[]>({
        queryKey: ["grapherSlugs"],
        queryFn: async () => {
            const response = await admin.getJSON<{
                charts: ChartListItem[]
            }>("/api/charts.json")
            return [
                ...response.charts.reduce((slugs, chart) => {
                    if (chart.slug && chart.isPublished) {
                        slugs.add(chart.slug)
                    }
                    return slugs
                }, new Set<string>()),
            ].sort()
        },
        staleTime: 5 * 60 * 1000,
    })
}
