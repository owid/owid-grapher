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
}

/** Every list page in `AdminApp`'s routes, in roughly its menu order. */
export const ADMIN_PAGES: AdminPage[] = [
    { path: "/charts", summary: "All charts" },
    { path: "/narrative-charts", summary: "Narrative charts" },
    {
        path: "/multi-dims",
        summary: "Multi-dimensional data pages (mdims)",
    },
    { path: "/multi-dim-redirects", summary: "Redirects for mdim slugs" },
    { path: "/featured-metrics", summary: "Featured metrics" },
    { path: "/data-insights", summary: "Data insights" },
    { path: "/gdocs", summary: "Google-Docs-authored content" },
    { path: "/dods", summary: "Details on demand" },
    { path: "/callout-functions", summary: "Callout functions" },
    { path: "/images", summary: "Images" },
    { path: "/files", summary: "Files" },
    { path: "/static-viz", summary: "Static visualisations" },
    { path: "/slideshows", summary: "Slideshows" },
    { path: `/${EXPLORERS_ROUTE_FOLDER}`, summary: "Explorers" },
    { path: "/explorer-tags", summary: "Explorer tags" },
    { path: "/variables", summary: "Indicators" },
    { path: "/datasets", summary: "Datasets" },
    { path: "/tags", summary: "Topic tags" },
    { path: "/tag-graph", summary: "The tag graph" },
    { path: "/users", summary: "Users" },
    { path: "/redirects", summary: "Chart redirects" },
    { path: "/site-redirects", summary: "Site redirects" },
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
    | { ok: true; path: string; search: string }
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
        return { ok: true, path, search }

    const pages = ADMIN_PAGES.map((page) => page.path)
    const { resolved, unresolved } = matchNames([path], pages, {
        normalize: alphanumericInsensitive,
    })
    if (resolved.length) return { ok: true, path: resolved[0], search }
    return { ok: false, candidates: unresolved[0]?.candidates ?? [] }
}

/** One line per list page, for a refusal or a tool description. */
export function describeAdminPages(): string {
    return ADMIN_PAGES.map((page) => `${page.path} (${page.summary})`).join(
        ", "
    )
}
