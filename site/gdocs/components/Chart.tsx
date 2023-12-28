import React, { useRef } from "react"
import { useEmbedChart } from "../../hooks.js"
import {
    grapherInterfaceWithHiddenControlsOnly,
    grapherInterfaceWithHiddenTabsOnly,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    ChartControlKeyword,
    ChartTabKeyword,
    EnrichedBlockChart,
    identity,
    Url,
    merge,
} from "@ourworldindata/utils"
import { renderSpans, useLinkedChart } from "../utils.js"
import cx from "classnames"
import { ExplorerProps } from "../../../explorer/Explorer.js"

export default function Chart({
    d,
    className,
}: {
    d: EnrichedBlockChart
    className?: string
}) {
    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(0, refChartContainer)

    // d.url may use an old slug that has since had a redirect created for it
    // useLinkedChart references a hashmap that has resolved these old slugs to their current chart
    // It also extracts the queryString from d.url (if present) and appends it to linkedChart.resolvedUrl
    // This means we can link to the same chart multiple times with different querystrings
    // and it should all resolve correctly via the same linkedChart
    const { linkedChart } = useLinkedChart(d.url)
    if (!linkedChart) return null

    const url = Url.fromURL(d.url)
    const resolvedUrl = linkedChart.resolvedUrl
    const isExplorer = url.isExplorer
    const hasControls = url.queryParams.hideControls !== "true"

    // applies to both charts and explorers
    const common = {
        // On mobile, we optimize for horizontal space by having Grapher bleed onto the edges horizontally.
        // We want to do this for all stand-alone charts and charts in a Key Insights block, but not for charts
        // listed in an All Charts block. The <Chart /> component is not used to render charts in an All Charts block,
        // so we can just set this to true here.
        shouldOptimizeForHorizontalSpace: true,
    }

    // props passed to explorers
    const explorerProps: Pick<
        ExplorerProps,
        "shouldOptimizeForHorizontalSpace"
    > = merge({}, common)

    // config passed to grapher charts
    let customizedChartConfig: GrapherProgrammaticInterface = {}
    const isCustomized = d.title || d.subtitle
    if (!isExplorer && isCustomized) {
        const controls: ChartControlKeyword[] = d.controls || []
        const tabs: ChartTabKeyword[] = d.tabs || []
        const showAllControls = controls.includes(ChartControlKeyword.all)
        const showAllTabs = tabs.includes(ChartTabKeyword.all)
        const listOfPartialGrapherConfigs = [...controls, ...tabs]
            .map(mapKeywordToGrapherConfig)
            .filter(identity) as GrapherProgrammaticInterface[]

        customizedChartConfig = merge(
            {},
            !showAllControls ? grapherInterfaceWithHiddenControlsOnly : {},
            !showAllTabs ? grapherInterfaceWithHiddenTabsOnly : {},
            ...listOfPartialGrapherConfigs,
            {
                hideRelatedQuestion: true,
                hideShareButton: true, // always hidden since the original chart would be shared, not the customized one
                hideExploreTheDataButton: false,
            },
            {
                title: d.title,
                subtitle: d.subtitle,
            }
        )

        // make sure the custom title is presented as is
        if (customizedChartConfig.title) {
            customizedChartConfig.forceHideAnnotationFieldsInTitle = {
                entity: true,
                time: true,
                changeInPrefix: true,
            }
        }
    }

    const chartConfig = merge({}, customizedChartConfig, common)

    return (
        <div
            className={cx(d.position, className)}
            style={{ gridRow: d.row, gridColumn: d.column }}
            ref={refChartContainer}
        >
            <figure
                // Use unique `key` to force React to re-render tree
                key={resolvedUrl}
                className={isExplorer && hasControls ? "explorer" : "chart"}
                data-grapher-src={isExplorer ? undefined : resolvedUrl}
                data-grapher-config={
                    isExplorer ? undefined : JSON.stringify(chartConfig)
                }
                data-explorer-src={isExplorer ? resolvedUrl : undefined}
                data-explorer-props={
                    isExplorer && !hasControls
                        ? JSON.stringify(explorerProps)
                        : undefined
                }
                style={{
                    width: "100%",
                    border: "0px none",
                    height: d.height,
                }}
            />
            {d.caption ? (
                <figcaption>{renderSpans(d.caption)}</figcaption>
            ) : null}
        </div>
    )
}

const mapKeywordToGrapherConfig = (
    keyword: ChartControlKeyword | ChartTabKeyword
): GrapherProgrammaticInterface | null => {
    switch (keyword) {
        // controls

        case ChartControlKeyword.relativeToggle:
            return { hideRelativeToggle: false }

        case ChartControlKeyword.timeline:
            return { hideTimeline: false, map: { hideTimeline: false } }

        case ChartControlKeyword.facetControl:
            return { hideFacetControl: false }

        case ChartControlKeyword.entitySelector:
            return { hideEntityControls: false }

        case ChartControlKeyword.zoomToggle:
            return { hideZoomToggle: false }

        case ChartControlKeyword.noDataAreaToggle:
            return { hideNoDataAreaToggle: false }

        case ChartControlKeyword.alignAxisScalesToggle:
            return { hideFacetYDomainToggle: false }

        case ChartControlKeyword.xLogLinearSelector:
            return { hideXScaleToggle: false }

        case ChartControlKeyword.yLogLinearSelector:
            return { hideYScaleToggle: false }

        case ChartControlKeyword.mapProjectionMenu:
            return { hideMapProjectionMenu: false }

        case ChartControlKeyword.tableFilterToggle:
            return { hideTableFilterToggle: false }

        // tabs

        case ChartTabKeyword.chart:
            return { hasChartTab: true }

        case ChartTabKeyword.map:
            return { hasMapTab: true }

        case ChartTabKeyword.table:
            return { hasTableTab: true }

        default:
            return null
    }
}
