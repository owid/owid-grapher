/**
 * The admin pages an agent may open by name.
 *
 * `open_admin_page` exists because the admin is much bigger than the handful
 * of surfaces that have their own tools: in testing, an agent asked to open
 * the data insights list, then the multi-dim list, could do neither and told
 * the user to navigate by hand. Rather than add one `open_*` tool per page,
 * this table names them once.
 *
 * Unknown paths are refused with candidates rather than navigated to, on the
 * same principle as entity and tag names: a wrong guess here takes the user's
 * page away from them and lands on the admin's 404.
 */
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { matchNames, alphanumericInsensitive } from "./matching.js"

export interface AdminPage {
    /** Admin-relative, as react-router sees it: no `/admin` prefix. */
    path: string
    summary: string
    /**
     * Whether the page reads `?search=` from the URL, which is what lets a
     * tool hand the user a filtered list rather than describing it. The pages
     * without it are the ones with no search box at all.
     */
    search?: true
}

/** Every list page in `AdminApp`'s routes, in roughly its menu order. */
export const ADMIN_PAGES: AdminPage[] = [
    { path: "/charts", summary: "All charts", search: true },
    { path: "/narrative-charts", summary: "Narrative charts", search: true },
    {
        path: "/multi-dims",
        summary: "Multi-dimensional data pages (mdims)",
        search: true,
    },
    {
        path: "/multi-dim-redirects",
        summary: "Redirects for mdim slugs",
        search: true,
    },
    { path: "/featured-metrics", summary: "Featured metrics", search: true },
    { path: "/data-insights", summary: "Data insights", search: true },
    {
        path: "/gdocs",
        summary: "Google-Docs-authored content",
        search: true,
    },
    { path: "/dods", summary: "Details on demand", search: true },
    { path: "/callout-functions", summary: "Callout functions" },
    { path: "/images", summary: "Images", search: true },
    { path: "/files", summary: "Files", search: true },
    { path: "/static-viz", summary: "Static visualisations", search: true },
    { path: "/slideshows", summary: "Slideshows", search: true },
    { path: `/${EXPLORERS_ROUTE_FOLDER}`, summary: "Explorers" },
    { path: "/explorer-tags", summary: "Explorer tags" },
    { path: "/variables", summary: "Indicators", search: true },
    { path: "/datasets", summary: "Datasets", search: true },
    { path: "/tags", summary: "Topic tags" },
    { path: "/tag-graph", summary: "The tag graph" },
    { path: "/users", summary: "Users", search: true },
    { path: "/redirects", summary: "Chart redirects" },
    { path: "/site-redirects", summary: "Site redirects", search: true },
    {
        path: "/bulk-grapher-config-editor",
        summary: "Bulk chart config editor",
    },
    { path: "/orphaned-articles", summary: "Orphaned articles" },
    { path: "/deploys", summary: "Deploy status" },
    { path: "/svgtester", summary: "SVG tester" },
    { path: "/test", summary: "Test charts" },
    { path: "/test-region-maps", summary: "Test region maps" },
]

/**
 * Detail pages, which carry an id we cannot enumerate. Kept deliberately
 * narrow: anything not listed here is a typo, not a page.
 */
const DETAIL_PATTERNS: RegExp[] = [
    /^\/charts\/\d+\/edit$/,
    /^\/charts\/create$/,
    /^\/narrative-charts\/\d+\/edit$/,
    /^\/multi-dims\/\d+$/,
    /^\/variables\/\d+$/,
    /^\/datasets\/\d+$/,
    /^\/sources\/\d+$/,
    /^\/tags\/\d+$/,
    /^\/users\/\d+$/,
    /^\/static-viz\/\d+$/,
    /^\/slideshows\/\d+\/edit$/,
    /^\/gdocs\/[\w-]+\/(preview|coverage)$/,
    new RegExp(`^/${EXPLORERS_ROUTE_FOLDER}/[\\w-]+$`),
]

export type ResolvedAdminPath =
    | { ok: true; path: string; search: string; searchable: boolean }
    | { ok: false; candidates: string[] }

/**
 * Accepts what an agent is likely to have: an admin path, a full staging or
 * localhost URL, or a page's name ("data insights"). Case and punctuation are
 * ignored when matching a list page, but the path we return keeps the caller's
 * spelling, because gdoc ids are case-sensitive.
 */
export function resolveAdminPath(input: string): ResolvedAdminPath {
    const withoutOrigin = input.trim().replace(/^[a-z]+:\/\/[^/]+/i, "")
    const [rawPath = "", rawSearch = ""] = withoutOrigin.split("?")
    const search = rawSearch ? `?${rawSearch}` : ""
    const path = rawPath
        .replace(/^\/?admin(?=\/|$)/, "")
        .replace(/\/+$/, "")
        .replace(/^\/?/, "/")

    if (DETAIL_PATTERNS.some((pattern) => pattern.test(path)))
        return { ok: true, path, search, searchable: false }

    const pages = ADMIN_PAGES.map((page) => page.path)
    const { resolved, unresolved } = matchNames([path], pages, {
        normalize: alphanumericInsensitive,
    })
    if (resolved.length) {
        const page = ADMIN_PAGES.find((p) => p.path === resolved[0])
        return {
            ok: true,
            path: resolved[0],
            search,
            searchable: !!page?.search,
        }
    }
    return { ok: false, candidates: unresolved[0]?.candidates ?? [] }
}

/** The pages whose search box an agent can fill from the URL. */
export function describeSearchablePages(): string {
    return ADMIN_PAGES.filter((page) => page.search)
        .map((page) => page.path)
        .join(", ")
}

/** One line per list page, for a refusal or a tool description. */
export function describeAdminPages(): string {
    return ADMIN_PAGES.map((page) => `${page.path} (${page.summary})`).join(
        ", "
    )
}
