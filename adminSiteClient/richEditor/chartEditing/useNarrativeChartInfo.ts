import { useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    RichEditorNarrativeChartInfo,
    RichEditorResolveReferencesResponse,
} from "../../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../../AdminAppContext.js"

/**
 * Resolved info (incl. numeric id, parent slug, config id) for a narrative
 * chart by name. Shared by the canvas NodeView and the block inspector;
 * invalidated when an embedded editing session saves and closes.
 */
export function useNarrativeChartInfo(name: string): {
    info: RichEditorNarrativeChartInfo | null | undefined
    isLoading: boolean
} {
    const { admin } = useContext(AdminAppContext)
    const infoQuery = useQuery({
        queryKey: ["richEditorNarrativeChart", name],
        queryFn: async () => {
            const response = (await admin.requestJSON(
                "/api/editor/resolveReferences",
                { narrativeChartNames: [name] },
                "POST"
            )) as unknown as RichEditorResolveReferencesResponse
            return response.narrativeCharts[name] ?? null
        },
        enabled: !!name,
        staleTime: Infinity,
    })
    return { info: infoQuery.data, isLoading: infoQuery.isLoading }
}
