import React, { useState } from "react"
import { ResolvedSlideChartInfo } from "@ourworldindata/types"
import { GRAPHER_DYNAMIC_CONFIG_URL } from "../../../settings/clientSettings.js"
import { parseSlideChartUrl } from "../../../site/slideshows/slideshowUtils.js"
import { SlideGrapher } from "./SlideGrapher.js"
import { SlideExplorer } from "./SlideExplorer.js"

interface SlideChartEmbedProps {
    /** The persisted slide URL. Updates as the user interacts with the chart, but
     * those updates do not feed back into the chart — only changes to
     * `chartApplyVersion` cause the preview to consume the latest URL. */
    url: string
    /** Pre-resolved chart info from bake time. If not provided, falls back to client-side resolution. */
    resolvedInfo?: ResolvedSlideChartInfo
    onQueryStringChange?: (queryString: string) => void
    /** Bumped by the editor when it wants the preview to consume the current URL.
     * Each bump remounts the inner chart with whatever `url` is at that moment. */
    chartApplyVersion: number
    /** If true, show timeline and controls. If false, hide them. */
    interactiveCharts?: boolean
    /** Called once when the chart is fully loaded, with its title and subtitle */
    onChartReady?: (info: { title: string; subtitle: string }) => void
}

/**
 * Embeds a chart (grapher, multi-dim, or explorer) in a slide.
 *
 * The persisted slide URL flows in via `url` and updates as the user interacts
 * with the chart. The preview only consumes a new URL when `chartApplyVersion`
 * bumps — at that moment we snapshot `url` into `appliedUrl` and re-key the
 * child chart to remount it. Between bumps, the chart is the source of truth
 * for what's on screen and reports user changes upward via `onQueryStringChange`.
 */
export function SlideChartEmbed(
    props: SlideChartEmbedProps
): React.ReactElement {
    const {
        url,
        resolvedInfo,
        onQueryStringChange,
        chartApplyVersion,
        interactiveCharts,
        onChartReady,
    } = props

    const [applied, setApplied] = useState({
        url,
        version: chartApplyVersion,
    })
    if (applied.version !== chartApplyVersion) {
        setApplied({ url, version: chartApplyVersion })
    }

    const parsed = parseSlideChartUrl(applied.url)
    const instanceKey = `${parsed.slug}-${applied.version}`

    const chartType = resolvedInfo?.type ?? parsed.type

    if (chartType === "explorer") {
        return (
            <SlideExplorer
                key={instanceKey}
                url={applied.url}
                onQueryStringChange={onQueryStringChange}
                interactiveCharts={interactiveCharts}
                onChartReady={onChartReady}
            />
        )
    }

    // For multi-dim with bake-time resolution, use the pre-resolved config UUID.
    // Without resolution info (admin editor), configUrl is left undefined so
    // SlideGrapher constructs it from the slug + initial query string (which
    // includes multi-dim dimension params for correct view resolution).
    const configUrl =
        resolvedInfo?.type === "multi-dim"
            ? `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${resolvedInfo.configId}.config.json`
            : undefined

    return (
        <SlideGrapher
            key={instanceKey}
            slug={parsed.slug}
            configUrl={configUrl}
            initialQueryString={parsed.queryString}
            onQueryStringChange={onQueryStringChange}
            interactiveCharts={interactiveCharts}
            onChartReady={onChartReady}
        />
    )
}
