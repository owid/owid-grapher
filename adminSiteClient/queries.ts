import { queryOptions } from "@tanstack/react-query"
import {
    DbPlainDod,
    DbPlainFile,
    DbPlainTag,
    DbPlainUser,
    DodUsageRecord,
    OwidGdocDataInsightIndexItem,
    OwidGdocIndexItem,
    SerializedGridProgram,
} from "@ourworldindata/types"
import {
    DbEnrichedImageWithPageviews,
    DbEnrichedStaticViz,
    FeaturedMetricByParentTagNameDictionary,
} from "@ourworldindata/utils"
import { GetAllExplorersRoute } from "@ourworldindata/explorer"
import {
    ApiNarrativeChartOverview,
    ApiSlideshowOverview,
} from "../adminShared/AdminTypes.js"
import { Admin } from "./Admin.js"
import { ChartListItem } from "./ChartList.js"
import { DatasetListItem } from "./DatasetList.js"
import { VariableListItem } from "./VariableList.js"

/**
 * Shared react-query definitions for admin collections.
 *
 * Each collection has exactly one query key and one raw queryFn, defined
 * here, so that every consumer (index pages, the command palette, ...)
 * shares the same cache entry. Keep queryFns raw: they return the
 * collection as served by the API. Consumers that need a different shape
 * (indexing, tree building, deserialization) should reshape via
 * react-query's `select` option so the cached data stays shareable.
 */

export interface AdminQueryOptions {
    /**
     * Fetch without triggering the full-screen loading indicator and
     * without raising the fatal error modal on failure. Used for
     * background fetches (e.g. the command palette) that should degrade
     * silently.
     */
    quiet?: boolean
}

function fetchOptions(opts?: AdminQueryOptions): {
    onFailure?: "show" | "continue"
    isBackground?: boolean
} {
    return opts?.quiet ? { onFailure: "continue", isBackground: true } : {}
}

export type ApiMultiDim = {
    id: number
    catalogPath: string
    title: string
    slug: string | null
    updatedAt: string
    published: boolean
    mdimViews: number
    pageviews: number
}

export type MultiDimRedirect = {
    id: number
    source: string
    sourceQueryParams: Record<string, string | null> | null
    multiDimId: number
    multiDimSlug: string
    multiDimTitle: string
    targetQueryStr: string | null
}

export type ChartRedirectListItem = {
    id: number
    slug: string
    chartId: number
    chartSlug: string
    targetQueryParam: string | null
}

export type SiteRedirect = {
    id: number
    source: string
    target: string
}

export const multiDimsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["multiDims"],
        queryFn: async () => {
            const { multiDims } = await admin.getJSON<{
                multiDims: ApiMultiDim[]
            }>("/api/multi-dims.json", {}, fetchOptions(opts))
            return multiDims
        },
    })

export const multiDimRedirectsQuery = (
    admin: Admin,
    opts?: AdminQueryOptions
) =>
    queryOptions({
        queryKey: ["allMultiDimRedirects"],
        queryFn: async () => {
            const { redirects } = await admin.getJSON<{
                redirects: MultiDimRedirect[]
            }>("/api/multi-dim-redirects.json", {}, fetchOptions(opts))
            return redirects
        },
    })

export const siteRedirectsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["siteRedirects"],
        queryFn: async () => {
            const { redirects } = await admin.getJSON<{
                redirects: SiteRedirect[]
            }>("/api/site-redirects.json", {}, fetchOptions(opts))
            return redirects
        },
    })

export const dodsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["dods"],
        queryFn: async () => {
            const { dods } = await admin.getJSON<{ dods: DbPlainDod[] }>(
                "/api/dods.json",
                {},
                fetchOptions(opts)
            )
            return dods
        },
    })

export const dodUsageQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["dod-usage"],
        queryFn: () =>
            admin.getJSON<Record<string, DodUsageRecord[]>>(
                "/api/dods-usage.json",
                {},
                fetchOptions(opts)
            ),
    })

export const usersQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["users"],
        queryFn: async () => {
            const { users } = await admin.getJSON<{ users: DbPlainUser[] }>(
                "/api/users.json",
                {},
                fetchOptions(opts)
            )
            return users
        },
    })

export const filesQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["files"],
        queryFn: async () => {
            const { files } = await admin.getJSON<{ files: DbPlainFile[] }>(
                "/api/files.json",
                {},
                fetchOptions(opts)
            )
            return files
        },
    })

export const staticVizQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["static-viz"],
        queryFn: () =>
            admin.getJSON<DbEnrichedStaticViz[]>(
                "/api/static-viz.json",
                {},
                fetchOptions(opts)
            ),
    })

export const chartsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["charts"],
        queryFn: async () => {
            const { charts } = await admin.getJSON<{ charts: ChartListItem[] }>(
                "/api/charts.json",
                {},
                fetchOptions(opts)
            )
            return charts
        },
    })

export const gdocsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["gdocs"],
        queryFn: () =>
            admin.getJSON<OwidGdocIndexItem[]>(
                "/api/gdocs",
                {},
                fetchOptions(opts)
            ),
    })

export const dataInsightsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["dataInsights"],
        queryFn: () =>
            admin.getJSON<OwidGdocDataInsightIndexItem[]>(
                "/api/dataInsights",
                {},
                fetchOptions(opts)
            ),
    })

export const narrativeChartsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["narrativeCharts"],
        queryFn: async () => {
            const { narrativeCharts } = await admin.getJSON<{
                narrativeCharts: ApiNarrativeChartOverview[]
            }>("/api/narrative-charts", {}, fetchOptions(opts))
            return narrativeCharts
        },
    })

export const datasetsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["datasets"],
        queryFn: async () => {
            const { datasets } = await admin.getJSON<{
                datasets: DatasetListItem[]
            }>("/api/datasets.json", {}, fetchOptions(opts))
            return datasets
        },
    })

export const tagsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["tags"],
        queryFn: async () => {
            const { tags } = await admin.getJSON<{ tags: DbPlainTag[] }>(
                "/api/tags.json",
                {},
                fetchOptions(opts)
            )
            return tags
        },
    })

export const imagesQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["images"],
        queryFn: async () => {
            const { images } = await admin.getJSON<{
                images: DbEnrichedImageWithPageviews[]
            }>("/api/images.json", {}, fetchOptions(opts))
            return images
        },
    })

export const slideshowsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["slideshows"],
        queryFn: async () => {
            const { slideshows } = await admin.getJSON<{
                slideshows: ApiSlideshowOverview[]
            }>("/api/slideshows.json", {}, fetchOptions(opts))
            return slideshows
        },
    })

export const chartRedirectsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["chartRedirects"],
        queryFn: async () => {
            const { redirects } = await admin.getJSON<{
                redirects: ChartRedirectListItem[]
            }>("/api/redirects.json", {}, fetchOptions(opts))
            return redirects
        },
    })

export const explorersQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["explorers"],
        queryFn: async () => {
            const response = await admin.getJSON<{
                explorers: SerializedGridProgram[]
            }>(`/${GetAllExplorersRoute}`, {}, fetchOptions(opts))
            return response.explorers ?? []
        },
    })

/** Server-side indicator search; the corpus is too large to fetch wholesale. */
export const indicatorSearchQuery = (
    admin: Admin,
    search: string,
    limit: number,
    opts?: AdminQueryOptions
) =>
    queryOptions({
        queryKey: ["indicatorSearch", search, limit],
        queryFn: async () => {
            const { variables } = await admin.getJSON<{
                variables: VariableListItem[]
            }>("/api/variables.json", { search, limit }, fetchOptions(opts))
            return variables
        },
    })

export const featuredMetricsQuery = (admin: Admin, opts?: AdminQueryOptions) =>
    queryOptions({
        queryKey: ["featuredMetrics"],
        queryFn: async () => {
            const { featuredMetrics } = await admin.getJSON<{
                featuredMetrics: FeaturedMetricByParentTagNameDictionary
            }>("/api/featured-metrics.json", {}, fetchOptions(opts))
            return featuredMetrics
        },
    })
