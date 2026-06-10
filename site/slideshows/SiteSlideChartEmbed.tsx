import React from "react"
import { ResolvedSlideChartInfo } from "@ourworldindata/types"
import { parseSlideChartUrl } from "./slideshowUtils.js"
import { GRAPHER_DYNAMIC_CONFIG_URL } from "../../settings/clientSettings.js"
import { SiteSlideGrapher } from "./SiteSlideGrapher.js"
import { SiteSlideExplorer } from "./SiteSlideExplorer.js"

/**
 * Chart embed for the baked site / preview.
 * Routes to the correct renderer (grapher or explorer) based on URL and
 * bake-time resolution info. No interactivity hooks or admin callbacks.
 */
export function SiteSlideChartEmbed(props: {
    url: string
    resolvedInfo?: ResolvedSlideChartInfo
    interactiveCharts?: boolean
}): React.ReactElement {
    const { url, resolvedInfo, interactiveCharts } = props
    const parsed = parseSlideChartUrl(url)
    const chartType = resolvedInfo?.type ?? parsed.type

    if (chartType === "explorer") {
        return (
            <SiteSlideExplorer
                url={url}
                interactiveCharts={interactiveCharts}
            />
        )
    }

    // For multi-dim with bake-time resolution, use the pre-resolved config UUID.
    // For regular graphers, use the slug-based config URL.
    const configUrl =
        resolvedInfo?.type === "multi-dim"
            ? `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${resolvedInfo.configId}.config.json`
            : `${GRAPHER_DYNAMIC_CONFIG_URL}/${parsed.slug}.config.json`

    return (
        <SiteSlideGrapher
            configUrl={configUrl}
            queryStr={parsed.queryString}
            interactiveCharts={interactiveCharts}
        />
    )
}
