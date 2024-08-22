import React, { useState, useRef } from "react"
import { orderBy, RelatedChart } from "@ourworldindata/utils"
import { useEmbedChart } from "../hooks.js"
import { GalleryArrow, GalleryArrowDirection } from "./GalleryArrow.js"
import { AllChartsListItem } from "./AllChartsListItem.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { GRAPHER_PREVIEW_CLASS } from "../SiteConstants.js"
import GrapherImage from "../GrapherImage.js"

export const RELATED_CHARTS_CLASS_NAME = "related-charts"

export const RelatedCharts = ({
    charts,
    showKeyChartsOnly = false,
}: {
    charts: RelatedChart[]
    showKeyChartsOnly?: boolean
}) => {
    const refChartContainer = useRef<HTMLDivElement>(null)
    const [activeChartIdx, setActiveChartIdx] = useState(0)

    const chartsToShow = showKeyChartsOnly
        ? charts.filter((chart) => !!chart.keyChartLevel)
        : charts

    const sortedCharts = orderBy(
        chartsToShow,
        (chart) => chart.keyChartLevel,
        "desc"
    )

    const isFirstSlideActive = activeChartIdx === 0
    const isLastSlideActive = activeChartIdx === sortedCharts.length - 1
    const activeChart = sortedCharts[activeChartIdx]
    const activeChartSlug = activeChart?.slug

    const onClickItem = (event: React.MouseEvent, idx: number) => {
        // Allow opening charts in new tab/window with ⌘+CLICK
        if (!event.metaKey && !event.shiftKey && !event.ctrlKey) {
            event.preventDefault()
            setActiveChartIdx(idx)
        }
    }

    useEmbedChart(activeChartIdx, refChartContainer)

    const grapherUrl = `${BAKED_BASE_URL}/grapher/${activeChartSlug}`

    const figure = (
        <figure
            className={GRAPHER_PREVIEW_CLASS}
            // Use unique `key` to force React to re-render tree
            key={activeChartSlug}
            data-grapher-src={grapherUrl}
        >
            <div className="js--hide-if-js-enabled">
                <a href={grapherUrl}>
                    <GrapherImage
                        slug={activeChartSlug}
                        alt={activeChart?.title}
                    />
                </a>
            </div>
        </figure>
    )

    const singleChartView = (
        <div className={RELATED_CHARTS_CLASS_NAME}>
            <div className="grid grid-cols-12">
                <div
                    className="related-charts__chart span-cols-7 span-md-cols-12"
                    ref={refChartContainer}
                >
                    {figure}
                </div>
            </div>
        </div>
    )

    const multipleChartsView = (
        <div className={RELATED_CHARTS_CLASS_NAME}>
            <div className="grid grid-cols-12">
                <div className="related-charts__thumbnails span-cols-5 span-md-cols-12">
                    <ul className="related-charts__list">
                        {sortedCharts.map((chart, idx) => (
                            <AllChartsListItem
                                chart={chart}
                                key={chart.slug}
                                onClick={(e) => onClickItem(e, idx)}
                                isActive={idx === activeChartIdx}
                            />
                        ))}
                    </ul>
                </div>
                <div
                    className="related-charts__chart span-cols-7 span-md-cols-12"
                    ref={refChartContainer}
                >
                    <div className="related-charts__figure">{figure}</div>
                    <div className="gallery-navigation">
                        <GalleryArrow
                            disabled={isFirstSlideActive}
                            onClick={() =>
                                setActiveChartIdx(activeChartIdx - 1)
                            }
                            direction={GalleryArrowDirection.prev}
                        ></GalleryArrow>
                        <div className="gallery-pagination">
                            {`Chart ${activeChartIdx + 1} of ${
                                sortedCharts.length
                            }`}
                        </div>
                        <GalleryArrow
                            disabled={isLastSlideActive}
                            onClick={() =>
                                setActiveChartIdx(activeChartIdx + 1)
                            }
                            direction={GalleryArrowDirection.next}
                        ></GalleryArrow>
                    </div>
                </div>
            </div>
        </div>
    )

    return charts.length === 1 ? singleChartView : multipleChartsView
}
