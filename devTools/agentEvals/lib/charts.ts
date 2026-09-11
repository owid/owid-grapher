import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { getContainerName } from "../../stagingHostname.js"

export interface ChartSpec {
    /** Short identifier used in case ids and file names. */
    key: string
    /** Path under /grapher/, including any query string. */
    path: string
    note?: string
    /** Restrict questions to these CSV columns (short names); default: every numeric column. */
    columns?: string[]
}

export interface ChartsFile {
    prBranch: string
    charts: ChartSpec[]
}

export const PROD_ORIGIN = "https://ourworldindata.org"

export const EVALS_DIR = path.dirname(
    path.dirname(fileURLToPath(import.meta.url))
)
export const RESULTS_DIR = path.join(EVALS_DIR, "results")

export function loadCharts(): ChartsFile {
    const file = path.join(EVALS_DIR, "charts.json")
    return JSON.parse(fs.readFileSync(file, "utf8")) as ChartsFile
}

export function stagingOrigin(branch: string): string {
    return `http://${getContainerName(branch)}`
}

export interface SplitPath {
    slug: string
    params: URLSearchParams
}

export function splitPath(chartPath: string): SplitPath {
    const [slug, search = ""] = chartPath.split("?")
    return { slug, params: new URLSearchParams(search) }
}

/**
 * URL of a grapher resource: `grapherUrl(origin, "life-expectancy", ".csv",
 * params, { csvType: "full" })`. Extra params are merged after the view params.
 */
export function grapherUrl(
    origin: string,
    slug: string,
    extension: string,
    params: URLSearchParams,
    extra: Record<string, string> = {}
): string {
    const merged = new URLSearchParams(params)
    for (const [k, v] of Object.entries(extra)) merged.set(k, v)
    const search = merged.size > 0 ? `?${merged.toString()}` : ""
    return `${origin}/grapher/${slug}${extension}${search}`
}

/** The public page URL a reader (or agent) would arrive at. */
export function prodPageUrl(spec: ChartSpec): string {
    return `${PROD_ORIGIN}/grapher/${spec.path}`
}
