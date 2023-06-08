import React, { useState, useRef } from "react"
import ReactDOM from "react-dom"
import { orderBy, RelatedChart } from "@ourworldindata/utils"
import { useEmbedChart } from "../hooks.js"
import { GalleryArrow, GalleryArrowDirection } from "./GalleryArrow.js"
import { AllChartsListItem } from "./AllChartsListItem.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

export const RELATED_CHARTS_CLASS_NAME = "related-charts"

export const RelatedCharts = ({ charts }: { charts: RelatedChart[] }) => {
    const refChartContainer = useRef<HTMLDivElement>(null)
    const [activeChartIdx, setActiveChartIdx] = useState(0)

    const isFirstSlideActive = activeChartIdx === 0
    const isLastSlideActive = activeChartIdx === charts.length - 1

    const sortedCharts = orderBy(charts, (chart) => chart.isKeyChart, "desc")
    const activeChartSlug = sortedCharts[activeChartIdx]?.slug

    const onClickItem = (event: React.MouseEvent, idx: number) => {
        // Allow opening charts in new tab/window with ⌘+CLICK
        if (!event.metaKey && !event.shiftKey && !event.ctrlKey) {
            event.preventDefault()
            setActiveChartIdx(idx)
        }
    }

    useEmbedChart(activeChartIdx, refChartContainer)

    return (
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
                    <figure
                        // Use unique `key` to force React to re-render tree
                        key={activeChartSlug}
                        data-grapher-src={`${BAKED_BASE_URL}/grapher/${activeChartSlug}`}
                    />
                    <div className="gallery-navigation">
                        <GalleryArrow
                            disabled={isFirstSlideActive}
                            onClick={() =>
                                setActiveChartIdx(activeChartIdx - 1)
                            }
                            direction={GalleryArrowDirection.prev}
                        ></GalleryArrow>
                        <div className="gallery-pagination">
                            {`Chart ${activeChartIdx + 1} of ${charts.length}`}
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
}

export const runRelatedCharts = (charts: RelatedChart[]) => {
    const relatedChartsEl = document.querySelector<HTMLElement>(
        `.${RELATED_CHARTS_CLASS_NAME}`
    )
    if (relatedChartsEl) {
        const relatedChartsWrapper = relatedChartsEl.parentElement
        ReactDOM.hydrate(
            <RelatedCharts charts={charts} />,
            relatedChartsWrapper
        )
    }
}
