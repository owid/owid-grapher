import React, { useRef } from "react"
import { useEmbedChart } from "../hooks.js"
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
import { renderSpans } from "./utils.js"
import cx from "classnames"

export default function Chart({
    d,
    className,
}: {
    d: EnrichedBlockChart
    className?: string
}) {
    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(0, refChartContainer)

    const url = Url.fromURL(d.url)
    const isExplorer = url.isExplorer
    const hasControls = url.queryParams.hideControls !== "true"
    const height = d.height || (isExplorer && hasControls ? 700 : 575)

    let config: GrapherProgrammaticInterface = {}
    const isCustomized = d.title || d.subtitle
    if (isCustomized) {
        const controls: ChartControlKeyword[] = d.controls || []
        const tabs: ChartTabKeyword[] = d.tabs || []
        const showAllControls = controls.includes(ChartControlKeyword.all)
        const showAllTabs = tabs.includes(ChartTabKeyword.all)
        const listOfPartialGrapherConfigs = [...controls, ...tabs]
            .map(mapKeywordToGrapherConfig)
            .filter(identity) as GrapherProgrammaticInterface[]

        config = merge(
            !showAllControls
                ? { ...grapherInterfaceWithHiddenControlsOnly }
                : {},
            !showAllTabs ? { ...grapherInterfaceWithHiddenTabsOnly } : {},
            ...listOfPartialGrapherConfigs,
            { hideRelatedQuestion: true },
            {
                title: d.title,
                subtitle: d.subtitle,
            }
        )

        // make sure the custom title is presented as is
        if (config.title) {
            config.forceHideAnnotationFieldsInTitle = {
                entity: true,
                time: true,
                changeInPrefix: true,
            }
        }
    }

    return (
        <div
            className={cx(d.position, className)}
            style={{ gridRow: d.row, gridColumn: d.column }}
            ref={refChartContainer}
        >
            <figure
                // Use unique `key` to force React to re-render tree
                key={d.url}
                data-grapher-src={isExplorer ? undefined : d.url}
                data-explorer-src={isExplorer ? d.url : undefined}
                data-grapher-config={
                    isCustomized && !isExplorer
                        ? JSON.stringify(config)
                        : undefined
                }
                style={{
                    width: "100%",
                    border: "0px none",
                    height,
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

        // tabs

        case ChartTabKeyword.chart:
            return { hasChartTab: true }

        case ChartTabKeyword.map:
            return { hasMapTab: true }

        case ChartTabKeyword.table:
            return { hasTableTab: true }

        case ChartTabKeyword.download:
            return { hasDownloadTab: true }

        default:
            return null
    }
}
