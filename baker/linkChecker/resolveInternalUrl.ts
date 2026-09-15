import {
    DecisionTreeNode,
    ExplorerRedirectTarget,
    matchQueryParamDecisionTree,
} from "@ourworldindata/utils"
import { RedirectMatcher } from "./cloudflareRedirects.js"

// Emulates how a request for an internal URL is served in production: the
// `_redirects` file first, then static assets, then the Cloudflare Pages
// Functions under functions/ (grapher and explorer slug redirects, and the
// routes that are served dynamically without a file on disk).

export type ExplorerRedirect = string | DecisionTreeNode<ExplorerRedirectTarget>

export interface ResolverContext {
    /** Whether a file exists in the baked site dir, e.g. "grapher/life-expectancy.html" */
    fileExists: (relativePath: string) => boolean
    redirects: RedirectMatcher
    /** Contents of grapher/_grapherRedirects.json: bare slug -> "target-slug" or "target-slug?query" */
    grapherRedirects: Record<string, string>
    /** Contents of explorers/_explorerRedirects.json: bare slug -> target slug or decision tree */
    explorerRedirects: Record<string, ExplorerRedirect>
    /** Hostnames whose absolute redirect targets are followed rather than treated as external */
    internalHosts: Set<string>
}

export type ResolutionKind = "file" | "dynamic-route" | "external-redirect"

export type Resolution =
    | { status: "ok"; kind: ResolutionKind; hops: string[] }
    // A tombstone page for deleted content: exists on disk but is served as a 404
    | { status: "tombstone"; hops: string[] }
    | { status: "broken"; hops: string[] }
    | { status: "too-many-redirects"; hops: string[] }

const MAX_HOPS = 10

// Keep in sync with `extensions` in functions/_common/env.ts
const KNOWN_EXTENSIONS = [
    ".config.json",
    ".png",
    ".svg",
    ".csv",
    ".metadata.json",
    ".readme.md",
    ".zip",
    ".values.json",
    ".search-result.json",
]

// Routes served entirely by Cloudflare Pages Functions. We can't verify these
// against the baked files, so they're assumed to resolve.
const DYNAMIC_ROUTE_PATTERNS = [
    /^\/api\/.+/,
    // Served by Cloudflare itself (e.g. email obfuscation, challenge scripts)
    /^\/cdn-cgi\/.+/,
    /^\/donation\/(donate|thank-you)$/,
    /^\/grapher\/by-uuid\/[^/]+$/,
    /^\/grapher\/thumbnail\/[^/]+$/,
    /^\/multi-dim\/[^/]+\.json$/,
]

interface Location {
    pathname: string
    search: string
}

function splitKnownExtension(fullSlug: string): {
    slug: string
    extension: string
} {
    for (const extension of KNOWN_EXTENSIONS) {
        if (fullSlug.endsWith(extension)) {
            return { slug: fullSlug.slice(0, -extension.length), extension }
        }
    }
    return { slug: fullSlug, extension: "" }
}

function findStaticFile(
    pathname: string,
    fileExists: ResolverContext["fileExists"]
): string | undefined {
    const relativePath = pathname.replace(/^\/+/, "")
    const candidates =
        relativePath === "" || relativePath.endsWith("/")
            ? [`${relativePath}index.html`]
            : [
                  relativePath,
                  `${relativePath}.html`,
                  `${relativePath}/index.html`,
              ]
    return candidates.find(fileExists)
}

function parseRedirectTarget(
    target: string,
    internalHosts: Set<string>
): Location | "external" {
    if (/^https?:\/\//i.test(target)) {
        try {
            const url = new URL(target)
            if (!internalHosts.has(url.hostname)) return "external"
            return { pathname: url.pathname, search: url.search }
        } catch {
            return "external"
        }
    }
    const [withoutHash] = target.split("#", 1)
    const [pathname, query] = withoutHash.split("?", 2)
    return { pathname: pathname || "/", search: query ? `?${query}` : "" }
}

/** Like createRedirectResponse in functions/_common/redirectTools.ts: the current URL's params win. */
function mergeSearchParams(
    currentSearch: string,
    targetQuery: string | undefined
): string {
    const merged = new URLSearchParams(targetQuery ?? "")
    for (const [key, value] of new URLSearchParams(currentSearch)) {
        merged.set(key, value)
    }
    const str = merged.toString()
    return str ? `?${str}` : ""
}

/** Like getRedirectForExplorerUrl: incoming params are forwarded, then the target's params applied. */
function applyExplorerTargetParams(
    currentSearch: string,
    targetQueryParams: Record<string, string | null>
): string {
    const params = new URLSearchParams(currentSearch)
    for (const [key, value] of Object.entries(targetQueryParams)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
    }
    const str = params.toString()
    return str ? `?${str}` : ""
}

function matchExplorerRedirect(
    redirect: ExplorerRedirect | undefined,
    search: string
): ExplorerRedirectTarget | undefined {
    if (!redirect) return undefined
    if (typeof redirect === "string")
        return { targetSlug: redirect, targetQueryParams: {} }
    return matchQueryParamDecisionTree(
        redirect,
        Object.fromEntries(new URLSearchParams(search))
    )
}

export function resolveInternalUrl(
    link: Location,
    ctx: ResolverContext
): Resolution {
    const hops: string[] = []
    let { pathname, search } = link

    for (let hop = 0; hop < MAX_HOPS; hop++) {
        const current = `${pathname}${search}`
        if (hops.includes(current))
            return { status: "too-many-redirects", hops: [...hops, current] }
        hops.push(current)

        // 1. Cloudflare Pages `_redirects`
        const redirect = ctx.redirects.match(pathname)
        if (redirect) {
            const next = parseRedirectTarget(redirect.target, ctx.internalHosts)
            if (next === "external")
                return { status: "ok", kind: "external-redirect", hops }
            pathname = next.pathname
            search = next.search || search
            continue
        }

        // 2. functions/explorers/[slug].ts checks for redirects on every
        //    request, before looking at the static assets
        const explorerMatch = pathname.match(/^\/explorers\/([^/]+)$/)
        if (explorerMatch) {
            const { slug, extension } = splitKnownExtension(explorerMatch[1])
            if (slug !== slug.toLowerCase()) {
                pathname = `/explorers/${slug.toLowerCase()}${extension}`
                continue
            }
            const target = matchExplorerRedirect(
                ctx.explorerRedirects[slug],
                search
            )
            if (target) {
                pathname = `/grapher/${target.targetSlug}${extension}`
                search = applyExplorerTargetParams(
                    search,
                    target.targetQueryParams
                )
                continue
            }
            if (extension && ctx.fileExists(`explorers/${slug}.html`))
                return { status: "ok", kind: "dynamic-route", hops }
        }

        // 3. Static assets
        const file = findStaticFile(pathname, ctx.fileExists)
        if (file) {
            // functions/deleted/[slug].ts serves these with a 404 status
            if (file.startsWith("deleted/"))
                return { status: "tombstone", hops }
            return { status: "ok", kind: "file", hops }
        }

        // 4. functions/grapher/[slug].ts: on a 404, lowercase the slug and
        //    consult _grapherRedirects.json
        const grapherMatch = pathname.match(/^\/grapher\/([^/]+)$/)
        if (grapherMatch) {
            const { slug, extension } = splitKnownExtension(grapherMatch[1])
            if (extension && ctx.fileExists(`grapher/${slug}.html`))
                return { status: "ok", kind: "dynamic-route", hops }
            if (slug !== slug.toLowerCase()) {
                pathname = `/grapher/${slug.toLowerCase()}${extension}`
                continue
            }
            const target = ctx.grapherRedirects[slug]
            const [targetSlug, targetQuery] = target?.split("?", 2) ?? []
            if (targetSlug && targetSlug !== slug) {
                pathname = `/grapher/${targetSlug}${extension}`
                search = mergeSearchParams(search, targetQuery)
                continue
            }
            return { status: "broken", hops }
        }

        // 5. Routes served dynamically without a file on disk
        if (DYNAMIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname)))
            return { status: "ok", kind: "dynamic-route", hops }

        return { status: "broken", hops }
    }

    return { status: "too-many-redirects", hops }
}
