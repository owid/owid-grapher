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
import { queryParamsToStr } from "@ourworldindata/utils"

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
    useEmbedChart(0, refChartContainer)

    const viewMetadata = useLinkedNarrativeChart(d.name)

    const { isPreviewing } = useContext(DocumentContext)

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

    const resolvedUrl = `${BAKED_GRAPHER_URL}/${viewMetadata.parentChartSlug}${queryParamsToStr(
        viewMetadata.queryParamsForParentChart
    )}`

    return (
        <div
            className={cx(d.position, className, {
                "full-width-on-mobile": fullWidthOnMobile,
            })}
            style={{ gridRow: d.row, gridColumn: d.column }}
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
                {...{
                    [GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR]:
                        metadataStringified,
                }}
            >
                <a href={resolvedUrl} target="_blank" rel="noopener">
                    <img
                        src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${viewMetadata.chartConfigId}.svg`}
                        alt={viewMetadata.title}
                        width={DEFAULT_GRAPHER_WIDTH}
                        height={DEFAULT_GRAPHER_HEIGHT}
                        loading="lazy"
                        data-no-lightbox
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
