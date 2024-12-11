import React, { useContext, useRef } from "react"
import { useEmbedChart } from "../../hooks.js"
import { EnrichedBlockNarrativeChart } from "@ourworldindata/types"
import cx from "classnames"
import { GRAPHER_PREVIEW_CLASS } from "../../SiteConstants.js"
import { AttachmentsContext } from "../../gdocs/AttachmentsContext.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import SpanElements from "./SpanElements.js"

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

    const attachments = useContext(AttachmentsContext)

    const viewMetadata = attachments.chartViewMetadata?.[d.name]

    if (!viewMetadata)
        return (
            <BlockErrorFallback
                className={className}
                error={{
                    name: "Narrative view not found",
                    message: `Narrative view with name "${d.name}" couldn't be found.`,
                }}
            />
        )

    const metadataStringified = JSON.stringify(viewMetadata)

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
                data-grapher-view-config={metadataStringified}
                // data-grapher-src={isExplorer ? undefined : resolvedUrl}
                style={{
                    width: "100%",
                    border: "0px none",
                    height: d.height,
                }}
            >
                {/* <a href={resolvedUrl} target="_blank" rel="noopener">
                    <GrapherImage slug={resolvedSlug} alt={d.title} />
                    <InteractionNotice />
                </a> */}
            </figure>
            {d.caption ? (
                <figcaption>
                    <SpanElements spans={d.caption} />
                </figcaption>
            ) : null}
        </div>
    )
}
