import {
    fetchWithRetry,
    fetchText,
    searchParamsToMultiDimView,
    extractMultiDimChoicesFromSearchParams,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import { ExplorerProps, buildExplorerProps } from "@ourworldindata/explorer"
import {
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
    MULTI_DIM_DYNAMIC_CONFIG_URL,
} from "../../settings/clientSettings.js"
import { parseSlideChartUrl } from "./slideshowUtils.js"

export type ResolvedChart =
    | { type: "grapher"; slug: string; queryString?: string }
    | {
          type: "multi-dim"
          slug: string
          configUrl: string
          queryString?: string
          /** Dimension params (e.g. metric, antigen) that must be preserved when grapher params change */
          dimensionParams: Record<string, string>
      }
    | { type: "explorer"; explorerProps: ExplorerProps }
    | { type: "loading" }
    | { type: "error"; message: string }

/**
 * Resolves a chart URL to the appropriate renderer.
 *
 * For `/grapher/` URLs:
 *   1. Try as a regular grapher config
 *   2. If 404, try as a multi-dim config → resolve to a view's UUID
 *
 * For `/explorers/` URLs:
 *   Fetch the explorer HTML and build props directly.
 */
async function resolveChartUrl(url: string): Promise<ResolvedChart> {
    const parsed = parseSlideChartUrl(url)

    if (parsed.type === "explorer") {
        try {
            const explorerUrl = `${BAKED_GRAPHER_URL.replace("/grapher", "")}/explorers/${parsed.slug}`
            const html = await fetchText(explorerUrl)
            // Append hideControls=true so explorer controls are hidden
            const searchParams = new URLSearchParams(
                parsed.queryString?.replace(/^\?/, "") ?? ""
            )
            searchParams.set("hideControls", "true")
            const props = await buildExplorerProps(
                html,
                `?${searchParams.toString()}`
            )
            return { type: "explorer", explorerProps: props }
        } catch {
            return {
                type: "error",
                message: `Failed to load explorer: ${parsed.slug}`,
            }
        }
    }

    // Try as a regular grapher first
    const grapherConfigUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/${parsed.slug}.config.json`
    try {
        const res = await fetchWithRetry(grapherConfigUrl)
        if (res.ok) {
            return {
                type: "grapher",
                slug: parsed.slug,
                queryString: parsed.queryString,
            }
        }
        // Only fall through to multi-dim on 404
        if (res.status !== 404) {
            return {
                type: "error",
                message: `Failed to load chart: ${parsed.slug} (${res.status})`,
            }
        }
    } catch {
        return {
            type: "error",
            message: `Failed to load chart: ${parsed.slug}`,
        }
    }

    // Try as a multi-dim (only reached on 404 from grapher)
    try {
        const mdimConfigUrl = `${MULTI_DIM_DYNAMIC_CONFIG_URL}/${parsed.slug}.json`
        const mdimConfig: MultiDimDataPageConfigEnriched = await fetchWithRetry(
            mdimConfigUrl
        ).then((res) => res.json())
        const searchParams = new URLSearchParams(parsed.queryString ?? "")
        // Always hide controls in slideshow context
        searchParams.set("hideControls", "true")
        const view = searchParamsToMultiDimView(mdimConfig, searchParams)
        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${view.fullConfigId}.config.json`
        // Extract dimension params so they can be preserved when
        // grapher params (time, tab, etc.) change
        const mdimParsed = MultiDimDataPageConfig.fromObject(mdimConfig)
        const dimensionParams = extractMultiDimChoicesFromSearchParams(
            searchParams,
            mdimParsed
        )
        return {
            type: "multi-dim",
            slug: parsed.slug,
            configUrl,
            queryString: parsed.queryString,
            dimensionParams,
        }
    } catch {
        return {
            type: "error",
            message: `No chart found for: ${url}`,
        }
    }
}

// Module-level cache so resolutions persist across renders.
const resolutionCache = new Map<string, Promise<ResolvedChart>>()

export function getCachedResolution(url: string): Promise<ResolvedChart> {
    const existing = resolutionCache.get(url)
    if (existing) return existing
    const promise = resolveChartUrl(url).then((result) => {
        // Evict failed resolutions so they can be retried
        if (result.type === "error") {
            resolutionCache.delete(url)
        }
        return result
    })
    resolutionCache.set(url, promise)
    return promise
}
