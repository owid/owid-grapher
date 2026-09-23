/**
 * The admin's chart-record helpers: what a chart is *beyond* its config once
 * it lives as a row in our database (revision logs, references, deletion,
 * the indicator config it inherits from). Used by the admin's chart editor
 * page and list; not part of the config-only editor.
 */
import * as _ from "lodash-es"
import { GrapherInterface, Json } from "@ourworldindata/utils"
import { Admin } from "./Admin.js"
import { observable, runInAction } from "mobx"
import { OriginUrlSuggestion, References } from "./AbstractChartEditor.js"
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

/**
 * Who last changed the map's color scale, and when. The editor can't know
 * this: it only ever sees one config, while the answer is in the diff
 * between two consecutive revisions.
 */
export function findLastMapColorScaleEdit(
    logs: Log[]
): MapColorScaleEdit | undefined {
    // Assumes logs are ordered from newest to oldest
    for (let i = 0; i < logs.length - 1; i++) {
        const current = logs[i].config?.map?.colorScale
        const previous = logs[i + 1].config?.map?.colorScale

        if (!_.isEqual(current, previous)) {
            return { userName: logs[i].userName, createdAt: logs[i].createdAt }
        }
    }

    // The map color scale has never been edited or the logs are empty
    return undefined
}

// Published topic-page slugs, fetched once and shared by every editor page
// that asks for them: the list is the same for all of them and doesn't change
// while the admin is open.
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
            // An empty dropdown is a fine outcome; the field takes any URL.
            .catch(() => undefined)
    }
    // Reading the box here is what makes the dropdown fill in once the
    // request lands, wherever it is being read from.
    return topicSlugsBox.get()
}

/**
 * What the admin offers in the editor's "Origin url" dropdown: the posts that
 * already show this chart first, since they are the likeliest answer, then
 * every published topic page.
 */
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

export interface NarrativeChartMinimalInformation {
    id: number
    name: string
    title: string
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
