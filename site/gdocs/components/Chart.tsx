import * as _ from "lodash-es"
import { useRef, useMemo, useContext, useEffect } from "react"
import { GuidedChartContext } from "@ourworldindata/grapher"
import { EnrichedBlockChart, Url } from "@ourworldindata/utils"
import { ChartConfigType, GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import { useLinkedChart } from "../utils.js"
import SpanElements from "./SpanElements.js"
import cx from "classnames"
import { GrapherWithFallback } from "../../GrapherWithFallback.js"
import { MultiDimEmbed } from "../../MultiDimEmbed.js"
import { useEmbedChart } from "../../hooks.js"
import { DocumentContext } from "../DocumentContext.js"

export default function Chart({
    d,
    className,
    fullWidthOnMobile = false,
}: {
    d: EnrichedBlockChart
    className?: string
    fullWidthOnMobile?: boolean
}) {
    const { isPreviewing, archiveContext } = useContext(DocumentContext)
    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(0, refChartContainer, isPreviewing)

    // Connect chart ref to GuidedChartContext for guided chart scrollTo on mobile
    const guidedChartContext = useContext(GuidedChartContext)
    useEffect(() => {
        if (guidedChartContext?.chartRef && refChartContainer.current) {
            guidedChartContext.chartRef.current = refChartContainer.current
        }
    }, [guidedChartContext])

    // d.url may use an old slug that has since had a redirect created for it
    // useLinkedChart references a hashmap that has resolved these old slugs to their current chart
    // It also extracts the queryString from d.url (if present) and appends it to linkedChart.resolvedUrl
    // This means we can link to the same chart multiple times with different querystrings
    // and it should all resolve correctly via the same linkedChart
    const { linkedChart } = useLinkedChart(d.url)

    const url = Url.fromURL(d.url)
    const resolvedUrl = linkedChart?.resolvedUrl
    const resolvedUrlParsed = Url.fromURL(resolvedUrl ?? "")
    const slug = resolvedUrlParsed.slug!
    const queryStr = resolvedUrlParsed.queryStr
    const isExplorer = linkedChart?.configType === ChartConfigType.Explorer
    const isMultiDim = linkedChart?.configType === ChartConfigType.MultiDim
    const hasControls = url.queryParams.hideControls !== "true"
    const isExplorerWithControls = isExplorer && hasControls
    const isMultiDimWithControls = isMultiDim && hasControls

    const chartConfig = useMemo(
        () => ({
            archiveContext: linkedChart?.archivedPageVersion,
        }),
        [linkedChart?.archivedPageVersion]
    )

    if (!linkedChart) return null

    if (
        archiveContext?.type === "archive-page" &&
        linkedChart.archivedPageVersion
    ) {
        const archiveUrl = Url.fromURL(
            linkedChart.archivedPageVersion.archiveUrl
        ).updateQueryParams(resolvedUrlParsed.queryParams)
        const defaultHeight =
            isMultiDimWithControls || isExplorerWithControls ? "680px" : "600px"
        return (
            <div
                className={cx(d.position, className, {
                    "full-width-on-mobile":
                        !isExplorerWithControls && fullWidthOnMobile,
                })}
                style={{ gridRow: d.row, gridColumn: d.column }}
            >
                <iframe
                    src={archiveUrl.fullUrl}
                    width="100%"
                    height={d.height || defaultHeight}
                    style={{
                        border: "0px none",
                        display: "block",
                    }}
                    loading="lazy"
                    title={linkedChart.title}
                />
                {d.caption ? (
                    <figcaption>
                        <SpanElements spans={d.caption} />
                    </figcaption>
                ) : null}
            </div>
        )
    }

    return (
        <div
            className={cx(d.position, className, {
                "full-width-on-mobile":
                    !isExplorerWithControls && fullWidthOnMobile,
            })}
            style={{ gridRow: d.row, gridColumn: d.column }}
            ref={refChartContainer}
        >
            {isExplorer ? (
                <figure
                    // Use unique `key` to force React to re-render tree
                    key={resolvedUrl}
                    className={cx({
                        [GRAPHER_PREVIEW_CLASS]: !isExplorer,
                        chart:
                            !isExplorerWithControls && !isMultiDimWithControls,
                        explorer: isExplorerWithControls,
                        "multi-dim": isMultiDimWithControls,
                    })}
                    data-is-multi-dim={isMultiDim || undefined}
                    data-grapher-src={isExplorer ? undefined : resolvedUrl}
                    data-explorer-src={isExplorer ? resolvedUrl : undefined}
                    style={{
                        width: "100%",
                        border: "0px none",
                        height: d.height,
                    }}
                >
                    <div className="js--show-warning-block-if-js-disabled" />
                </figure>
            ) : isMultiDim ? (
                <MultiDimEmbed
                    url={d.url}
                    chartConfig={chartConfig}
                    isPreviewing={isPreviewing}
                />
            ) : (
                <GrapherWithFallback
                    slug={slug}
                    config={chartConfig}
                    queryStr={queryStr}
                    isEmbeddedInAnOwidPage={true}
                    isEmbeddedInADataPage={false}
                    isPreviewing={isPreviewing}
                />
            )}
            {d.caption ? (
                <figcaption>
                    <SpanElements spans={d.caption} />
                </figcaption>
            ) : null}
        </div>
    )
}
