/**
 * The admin's chart-record helpers: what a chart is *beyond* its config once
 * it lives as a row in our database (revision logs, references, deletion,
 * the indicator config it inherits from). Used by the admin's chart editor
 * page and list; not part of the config-only editor.
 */
import * as _ from "lodash-es"
import { GrapherInterface, Json, PostReference } from "@ourworldindata/utils"
import { ContentGraphLinkType } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { DataInsightMinimalInformation } from "../adminShared/AdminTypes.js"
import { ENV } from "../settings/clientSettings.js"

export interface Log {
    userId: number
    userName: string
    config: Json
    createdAt: string
}

export interface NarrativeChartMinimalInformation {
    id: number
    name: string
    title: string
}

export interface References {
    postsWordpress?: PostReference[]
    postsGdocs?: PostReference[]
    explorers?: string[]
    narrativeCharts?: NarrativeChartMinimalInformation[]
    dataInsights?: DataInsightMinimalInformation[]
    staticViz?: StaticVizReference[]
}

export interface StaticVizReference {
    id: number
    name: string
    grapherSlug?: string | null
    type: ContentGraphLinkType.StaticViz
}

export const getFullReferencesCount = (references: References): number => {
    // Get a unique count so double references (e.g. via grapher-url + inline link) are not overcounted.
    const allRefs = Object.values(
        references
    ).flat() as References[keyof References][]
    const uniqueRefs = new Set(
        allRefs.map((ref) => {
            if (typeof ref === "string") return `string:${ref}`
            if (!ref || typeof ref !== "object") {
                return `unknown:${String(ref)}`
            }
            const typedRef = ref as {
                type?: string
                slug?: string
                id?: string | number
            }
            const type = typedRef.type ?? "unknown"
            const slug = typedRef.slug ?? typedRef.id ?? "unknown"
            return `${type}:${slug}`
        })
    )
    return uniqueRefs.size
}

export async function deleteChart(params: {
    admin: Admin
    chartId?: number
    chartSlug?: string
    references?: References
    onSuccess?: () => void
}): Promise<void> {
    const { admin, chartId, chartSlug, references, onSuccess } = params

    // Delete only makes sense for saved charts
    if (chartId === undefined || chartId === 0) return

    // Check for references
    if (references && getFullReferencesCount(references) > 0) {
        window.alert(
            `Cannot delete chart ${chartSlug} because it is used in ${getFullReferencesCount(
                references
            )} places. See the references tab in the chart editor for details.`
        )
        return
    }

    // Confirm deletion (drafts may have no slug yet)
    const chartName = chartSlug || `#${chartId}`
    let confirmMessage = `Delete the chart ${chartName}? This action cannot be undone!`
    if (ENV === "staging") {
        confirmMessage +=
            "\n\n⚠️ WARNING: You are on a staging server. Deleted charts are NOT synced to production servers. If this chart exists on production, it will remain there even after deletion here."
    }
    if (!window.confirm(confirmMessage)) return

    const json = await admin.requestJSON(`/api/charts/${chartId}`, {}, "DELETE")

    if (json.success) onSuccess?.()
}

/** The grapher config an indicator carries (its ETL-authored defaults), or
 *  undefined if it has none. */
export async function fetchChartConfigByIndicatorId(
    admin: Admin,
    indicatorId: number
): Promise<GrapherInterface | undefined> {
    const indicatorChart = await admin.getJSON(
        `/api/variables/${indicatorId}.config.json`
    )
    return _.isEmpty(indicatorChart) ? undefined : indicatorChart
}
