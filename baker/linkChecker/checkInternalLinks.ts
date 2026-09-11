import fs from "fs-extra"
import path from "path"
import { RedirectMatcher } from "./cloudflareRedirects.js"
import {
    ALWAYS_INTERNAL_HOSTS,
    extractInternalLinks,
    InternalLink,
} from "./extractLinks.js"
import {
    ExplorerRedirect,
    Resolution,
    resolveInternalUrl,
    ResolverContext,
} from "./resolveInternalUrl.js"

export interface LinkCheckOptions {
    bakedSiteDir: string
    baseUrl: string
    log?: (message: string) => void
}

export interface LinkProblem {
    url: string
    status: Exclude<Resolution["status"], "ok">
    hops: string[]
    /** Pages (as site paths) linking to this URL */
    sources: string[]
}

export interface LinkCheckResult {
    pagesScanned: number
    /** Pages on disk that were skipped because their own URL redirects elsewhere */
    unreachablePages: string[]
    uniqueUrls: number
    counts: Record<string, number>
    /** URLs that don't resolve, or redirect forever */
    broken: LinkProblem[]
    /** URLs that resolve to a tombstone page for deleted content (served as 404) */
    tombstones: LinkProblem[]
}

function listFiles(dir: string): string[] {
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
            path
                .relative(dir, path.join(entry.parentPath, entry.name))
                .split(path.sep)
                .join("/")
        )
}

async function readJsonIfExists<T>(
    filePath: string,
    fallback: T,
    log: (message: string) => void
): Promise<T> {
    if (!(await fs.pathExists(filePath))) {
        log(`⚠️  ${filePath} not found, continuing without it`)
        return fallback
    }
    return fs.readJson(filePath)
}

function pageUrlPath(relativeHtmlPath: string): string {
    const withoutExt = relativeHtmlPath.replace(/\.html$/, "")
    if (withoutExt === "index") return "/"
    return `/${withoutExt.replace(/\/index$/, "")}`
}

/**
 * A page that exists on disk but whose own URL gets redirected elsewhere (e.g.
 * a stale file left over from a previous bake) is never served, so the links
 * on it don't matter.
 */
function checkIsPageReachable(pagePath: string, ctx: ResolverContext): boolean {
    const resolution = resolveInternalUrl(
        { pathname: pagePath, search: "" },
        ctx
    )
    return resolution.status !== "broken" && resolution.hops.length === 1
}

export async function checkInternalLinks(
    options: LinkCheckOptions
): Promise<LinkCheckResult> {
    const { bakedSiteDir } = options
    const log = options.log ?? (() => undefined)
    const baseUrl = new URL(options.baseUrl)
    const internalHosts = new Set([baseUrl.hostname, ...ALWAYS_INTERNAL_HOSTS])

    log(`Indexing files in ${bakedSiteDir}`)
    const files = new Set(listFiles(bakedSiteDir))
    const htmlFiles = [...files].filter((file) => file.endsWith(".html"))
    log(`Found ${files.size} files, ${htmlFiles.length} HTML pages`)

    const redirectsPath = path.join(bakedSiteDir, "_redirects")
    const redirects = (await fs.pathExists(redirectsPath))
        ? RedirectMatcher.fromFileContents(
              await fs.readFile(redirectsPath, "utf8")
          )
        : new RedirectMatcher([])
    if (!(await fs.pathExists(redirectsPath)))
        log(`⚠️  ${redirectsPath} not found, continuing without it`)

    const ctx: ResolverContext = {
        fileExists: (relativePath) => files.has(relativePath),
        redirects,
        grapherRedirects: await readJsonIfExists<Record<string, string>>(
            path.join(bakedSiteDir, "grapher/_grapherRedirects.json"),
            {},
            log
        ),
        explorerRedirects: await readJsonIfExists<
            Record<string, ExplorerRedirect>
        >(
            path.join(bakedSiteDir, "explorers/_explorerRedirects.json"),
            {},
            log
        ),
        internalHosts,
    }

    // Unique URL -> the pages linking to it
    const linksByUrl = new Map<
        string,
        { link: InternalLink; sources: Set<string> }
    >()
    let pagesScanned = 0
    const unreachablePages: string[] = []
    for (const htmlFile of htmlFiles) {
        const sourcePage = pageUrlPath(htmlFile)
        if (!checkIsPageReachable(sourcePage, ctx)) {
            unreachablePages.push(sourcePage)
            continue
        }
        const html = await fs.readFile(
            path.join(bakedSiteDir, htmlFile),
            "utf8"
        )
        for (const link of extractInternalLinks(html, baseUrl, internalHosts)) {
            // A page's links to itself (canonical URL, og:url) can't be broken
            if (link.pathname === sourcePage) continue
            const key = `${link.pathname}${link.search}`
            const entry = linksByUrl.get(key)
            if (entry) entry.sources.add(sourcePage)
            else linksByUrl.set(key, { link, sources: new Set([sourcePage]) })
        }
        pagesScanned++
        if (pagesScanned % 1000 === 0)
            log(`Scanned ${pagesScanned}/${htmlFiles.length} pages`)
    }
    if (unreachablePages.length)
        log(
            `Skipped ${unreachablePages.length} pages whose own URL is redirected elsewhere`
        )
    log(`Resolving ${linksByUrl.size} unique internal URLs`)

    const counts: Record<string, number> = {}
    const broken: LinkProblem[] = []
    const tombstones: LinkProblem[] = []
    for (const [url, { link, sources }] of linksByUrl) {
        const resolution = resolveInternalUrl(link, ctx)
        const label =
            resolution.status === "ok"
                ? `ok:${resolution.kind}`
                : resolution.status
        counts[label] = (counts[label] ?? 0) + 1
        if (resolution.status === "ok") continue
        const problem: LinkProblem = {
            url,
            status: resolution.status,
            hops: resolution.hops,
            sources: [...sources].sort(),
        }
        if (resolution.status === "tombstone") tombstones.push(problem)
        else broken.push(problem)
    }
    const byUrl = (a: LinkProblem, b: LinkProblem): number =>
        a.url.localeCompare(b.url)
    broken.sort(byUrl)
    tombstones.sort(byUrl)

    return {
        pagesScanned,
        unreachablePages: unreachablePages.sort(),
        uniqueUrls: linksByUrl.size,
        counts,
        broken,
        tombstones,
    }
}
