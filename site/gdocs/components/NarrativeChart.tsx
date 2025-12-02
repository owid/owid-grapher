import { useContext, useRef } from "react"
import { useEmbedChart } from "../../hooks.js"
import {
    EnrichedBlockNarrativeChart,
    GRAPHER_PREVIEW_CLASS,
} from "@ourworldindata/types"
import { useLinkedNarrativeChart } from "../utils.js"
import cx from "classnames"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import SpanElements from "./SpanElements.js"
import { DocumentContext } from "../DocumentContext.js"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
    GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR,
} from "@ourworldindata/grapher"
import {
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../../settings/clientSettings.js"
import { queryParamsToStr, readFromAssetMap } from "@ourworldindata/utils"

export default function NarrativeChart({
    d,
    className,
    fullWidthOnMobile = false,
}: {
    d: EnrichedBlockNarrativeChart
    className?: string
    fullWidthOnMobile?: boolean
}) {
    const refChartContainer = useRef<HTMLDivElement>(null)
    const { isPreviewing, archiveContext } = useContext(DocumentContext)
    useEmbedChart(0, refChartContainer, isPreviewing)

    const viewMetadata = useLinkedNarrativeChart(d.name)

    if (!viewMetadata) {
        if (isPreviewing) {
            return (
                <BlockErrorFallback
                    className={className}
                    error={{
                        name: "Narrative chart not found",
                        message: `Narrative chart with name "${d.name}" couldn't be found.`,
                    }}
                />
            )
        } else return null // If not previewing, just don't render anything
    }

    const metadataStringified = JSON.stringify(viewMetadata)

    const parentQueryString = queryParamsToStr(
        viewMetadata.queryParamsForParentChart
    )
    const resolvedUrl = `${BAKED_GRAPHER_URL}/${viewMetadata.parentChartSlug}${parentQueryString}`

    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const assetMap = isOnArchivalPage
        ? archiveContext?.assets?.runtime
        : undefined

    const archivedParentUrl = viewMetadata.latestArchivedParent?.archiveUrl
        ? `${viewMetadata.latestArchivedParent.archiveUrl}${parentQueryString}`
        : undefined
    const linkTarget =
        isOnArchivalPage && archivedParentUrl ? archivedParentUrl : resolvedUrl

    const imageSrc = readFromAssetMap(assetMap, {
        path: d.name,
        fallback: `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${viewMetadata.chartConfigId}.png`,
    })

    return (
        <div
            className={cx(className, {
                "full-width-on-mobile": fullWidthOnMobile,
            })}
            ref={refChartContainer}
        >
            <figure
                key={metadataStringified}
                className={cx(GRAPHER_PREVIEW_CLASS, "chart")}
                style={{
                    width: "100%",
                    border: "0px none",
                    height: d.height,
                }}
                // MultiEmbedder should not kick in on archival pages.
                {...(!isOnArchivalPage && {
                    [GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR]:
                        metadataStringified,
                })}
            >
                <a href={linkTarget}>
                    <img
                        className="GrapherImage"
                        src={imageSrc}
                        alt={viewMetadata.title}
                        width={DEFAULT_GRAPHER_WIDTH}
                        height={DEFAULT_GRAPHER_HEIGHT}
                        loading="lazy"
                    />
                </a>
            </figure>
            {d.caption ? (
                <figcaption>
                    <SpanElements spans={d.caption} />
                </figcaption>
            ) : null}
        </div>
    )
}
