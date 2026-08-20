import { queryOptions } from "@tanstack/react-query"
import {
    DbPlainDod,
    DbPlainFile,
    DbPlainUser,
    DodUsageRecord,
} from "@ourworldindata/types"
import {
    DbEnrichedStaticViz,
    FeaturedMetricByParentTagNameDictionary,
} from "@ourworldindata/utils"
import { Admin } from "./Admin.js"

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
