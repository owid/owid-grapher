import * as _ from "lodash-es"
import { GrapherInterface, Json, PostReference } from "@ourworldindata/utils"
import { ContentGraphLinkType } from "@ourworldindata/types"
import { migrateGrapherConfigToLatestVersion } from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import { observable, runInAction } from "mobx"
import { OriginUrlSuggestion } from "./ConfigEditor.js"
import { DataInsightMinimalInformation } from "../adminShared/AdminTypes.js"
import { BAKED_BASE_URL, ENV } from "../settings/clientSettings.mjs"

export interface Log {
    userId: number
    userName: string
    config: Json
    createdAt: string
}

export interface MapColorScaleEdit {
    userName: string
    createdAt: string
}

export function findLastMapColorScaleEdit(
    logsNewestFirst: Log[]
): MapColorScaleEdit | undefined {
    for (let i = 0; i < logsNewestFirst.length - 1; i++) {
        const current = logsNewestFirst[i].config?.map?.colorScale
        const previous = logsNewestFirst[i + 1].config?.map?.colorScale

        if (!_.isEqual(current, previous)) {
            return {
                userName: logsNewestFirst[i].userName,
                createdAt: logsNewestFirst[i].createdAt,
            }
        }
    }

    return undefined
}

const topicSlugsBox = observable.box<string[]>([])
let topicSlugsRequested = false

function adminTopicSlugs(admin: Admin): string[] {
    if (!topicSlugsRequested) {
        topicSlugsRequested = true
        void admin
            .getJSON<{ slugs: string[] }>("/api/gdocs/publishedTopicSlugs")
            .then((json) =>
                runInAction(() =>
                    topicSlugsBox.set(
                        json.slugs.slice().sort((a, b) => a.localeCompare(b))
                    )
                )
            )
            .catch(() => undefined)
    }
    return topicSlugsBox.get()
}

export function adminOriginUrlSuggestions(
    admin: Admin,
    references: References | undefined
): OriginUrlSuggestion[] {
    const posts = [
        ...(references?.postsWordpress ?? []),
        ...(references?.postsGdocs ?? []),
    ].map((post) => ({
        url: post.url.replace(BAKED_BASE_URL, ""),
        hint: "(referenced by this chart)",
    }))

    return [
        ...posts,
        ...adminTopicSlugs(admin).map((slug) => ({ url: `/${slug}` })),
    ]
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

export interface NarrativeChartMinimalInformation {
    id: number
    name: string
    title: string
}

export const getFullReferencesCount = (references: References): number => {
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

    if (chartId === undefined || chartId === 0) return

    if (references && getFullReferencesCount(references) > 0) {
        window.alert(
            `Cannot delete chart ${chartSlug} because it is used in ${getFullReferencesCount(
                references
            )} places. See the references tab in the chart editor for details.`
        )
        return
    }

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

export async function fetchChartConfigByIndicatorId(
    admin: Admin,
    indicatorId: number
): Promise<GrapherInterface | undefined> {
    const indicatorChart = await admin.getJSON(
        `/api/variables/${indicatorId}.config.json`
    )
    return _.isEmpty(indicatorChart) ? undefined : indicatorChart
}

const REVISION_RESTORE_KEPT_KEYS = [
    "id",
    "version",
    "slug",
    "isPublished",
] as const satisfies readonly (keyof GrapherInterface)[]

export function makeRestoredPatchConfig(
    revisionConfig: Json,
    currentPatchConfig: GrapherInterface
): GrapherInterface {
    const migrated = migrateGrapherConfigToLatestVersion(revisionConfig)
    return {
        ..._.omit(migrated, REVISION_RESTORE_KEPT_KEYS),
        ..._.pick(currentPatchConfig, REVISION_RESTORE_KEPT_KEYS),
    }
}
