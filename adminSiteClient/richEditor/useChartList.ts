import { useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdminAppContext } from "../AdminAppContext.js"

export const GRAPHER_URL_PREFIX = "https://ourworldindata.org/grapher/"

export interface ChartListItem {
    id: number
    title: string
    slug: string
    isPublished: boolean
}

export function useChartList(): ChartListItem[] {
    const { admin } = useContext(AdminAppContext)
    const chartsQuery = useQuery({
        queryKey: ["richEditorChartList"],
        // fail-soft: without the chart list the field still accepts pasted
        // grapher URLs, so a failing list endpoint must not break the editor
        queryFn: async () => {
            const response = await admin.rawRequest(
                "/api/charts.json",
                undefined,
                "GET"
            )
            if (!response.ok) return { charts: [] }
            return (await response.json()) as { charts: ChartListItem[] }
        },
        staleTime: Infinity,
        retry: false,
    })
    return chartsQuery.data?.charts ?? []
}
