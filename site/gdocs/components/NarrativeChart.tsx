import { useRef } from "react"
import { useIsClient } from "usehooks-ts"
import { useEmbedChart } from "../../hooks.js"
import {
    EnrichedBlockNarrativeChart,
    GRAPHER_PREVIEW_CLASS,
    HIDE_IF_JS_ENABLED_CLASSNAME,
} from "@ourworldindata/types"
import { useLinkedNarrativeChart } from "../utils.js"
import cx from "clsx"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import SpanElements from "./SpanElements.js"
import { useDocumentContext } from "../DocumentContext.js"
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
    const { isPreviewing, archiveContext } = useDocumentContext()
    const isClient = useIsClient()
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
    const shouldRenderImage = isOnArchivalPage || !isClient

    return (
        <div
            className={cx(className, {
                "full-width-on-mobile": fullWidthOnMobile,
            })}
            ref={refChartContainer}
        >
            <div
                className="owid-chart-frame"
                // On archival pages the static image is the permanent rendering,
                // so let it dictate the height instead of forcing the live-Grapher
                // default (which leaves blank space when the image's aspect ratio
                // doesn't match the frame's, e.g. in column layouts).
                style={
                    isOnArchivalPage
                        ? { height: "auto" }
                        : d.height
                          ? { height: d.height }
                          : undefined
                }
            >
                <figure
                    key={metadataStringified}
                    className={cx(GRAPHER_PREVIEW_CLASS, "chart")}
                    // MultiEmbedder should not kick in on archival pages.
                    {...(!isOnArchivalPage && {
                        [GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR]:
                            metadataStringified,
                    })}
                >
                    {shouldRenderImage && (
                        <a
                            className={cx({
                                [HIDE_IF_JS_ENABLED_CLASSNAME]:
                                    !isOnArchivalPage,
                            })}
                            href={linkTarget}
                        >
                            <img
                                className="GrapherImage"
                                src={imageSrc}
                                alt={viewMetadata.title}
                                width={DEFAULT_GRAPHER_WIDTH}
                                height={DEFAULT_GRAPHER_HEIGHT}
                                loading="lazy"
                            />
                        </a>
                    )}
                </figure>
            </div>
            {d.caption ? (
                <figcaption>
                    <SpanElements spans={d.caption} />
                </figcaption>
            ) : null}
        </div>
    )
}
