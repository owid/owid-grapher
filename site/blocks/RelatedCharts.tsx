import React from "react"
import ReactDOM from "react-dom"
import { useState, useRef } from "react"
import { RelatedChart } from "../../clientUtils/owidTypes.js"
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

    const sortedCharts = [...charts].sort(
        // isKey is returned from MySQL as 0, 1 or NULL
        (a, b) => Number(!!b.isKey) - Number(!!a.isKey)
    )
    const activeChartSlug = sortedCharts[activeChartIdx].slug

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
            <div className="wp-block-columns is-style-sticky-right">
                <div className="wp-block-column">
                    <ul>
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
                    className="wp-block-column"
                    id="all-charts-preview"
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
