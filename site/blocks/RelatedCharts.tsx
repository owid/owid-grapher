import * as _ from "lodash-es"
import { useState, useRef, useContext } from "react"
import * as React from "react"
import { RelatedChart } from "@ourworldindata/utils"
import { GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import { GalleryArrow } from "./GalleryArrow.js"
import { GalleryArrowDirection } from "../SiteConstants.js"
import { AllChartsListItem } from "./AllChartsListItem.js"
import { GrapherWithFallback } from "../GrapherWithFallback.js"
import { DocumentContext } from "../gdocs/DocumentContext.js"

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
    const { isPreviewing } = useContext(DocumentContext)

    const chartsToShow = showKeyChartsOnly
        ? charts.filter((chart) => !!chart.keyChartLevel)
        : charts

    const sortedCharts = _.orderBy(
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

    const figure = (
        <GrapherWithFallback
            slug={activeChartSlug}
            className={GRAPHER_PREVIEW_CLASS}
            id={`related-chart-${activeChartIdx}`}
            enablePopulatingUrlParams={true}
            isEmbeddedInAnOwidPage={true}
            isEmbeddedInADataPage={false}
            config={{ archiveContext: activeChart.archiveContext }}
            isPreviewing={isPreviewing}
        />
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
