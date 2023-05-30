import React, { useRef } from "react"
import { useEmbedChart } from "../hooks.js"
import {
    grapherInterfaceWithHiddenControlsOnly,
    grapherInterfaceWithHiddenTabsOnly,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    ChartShowKeyword,
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
        const show: ChartShowKeyword[] = d.show || []
        const showAllControls = show.includes("all controls")
        const showAllTabs = show.includes("all tabs")
        const listOfPartialGrapherConfigs = show
            .map((s) => mapKeywordToGrapherConfig(s))
            .filter(identity) as GrapherProgrammaticInterface[]

        config = merge(
            !showAllControls ? grapherInterfaceWithHiddenControlsOnly : {},
            !showAllTabs ? grapherInterfaceWithHiddenTabsOnly : {},
            ...listOfPartialGrapherConfigs,
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
    keyword: ChartShowKeyword
): GrapherProgrammaticInterface | null => {
    switch (keyword) {
        case "relative toggle":
            return { hideRelativeToggle: false }

        case "timeline":
            return { hideTimeline: false, map: { hideTimeline: false } }

        case "facet control":
            return { hideFacetControl: false }

        case "entity selector":
        case "country selector":
            return { hideEntityControls: false }

        case "zoom toggle":
            return { hideZoomToggle: false }

        case "no data area toggle":
        case "data area toggle":
        case "area toggle":
            return { hideNoDataAreaToggle: false }

        case "align axis scales toggle":
        case "align axis toggle":
            return { hideFacetYDomainToggle: false }

        case "x log/linear selector":
        case "x log selector":
            return { hideXScaleToggle: false }

        case "y log/linear selector":
        case "y log selector":
            return { hideYScaleToggle: false }

        case "chart tab":
            return { hasChartTab: true }

        case "map tab":
            return { hasMapTab: true }

        case "table tab":
            return { hasTableTab: true }

        case "sources tab":
        case "source tab":
            return { hasSourcesTab: true }

        case "download tab":
            return { hasDownloadTab: true }

        default:
            return null
    }
}
