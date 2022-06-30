import React from "react"
import ReactDOM from "react-dom"
import { useState } from "react"
import { RelatedChart } from "../../clientUtils/owidTypes.js"
import { Modal } from "../Modal.js"
import { GalleryArrow, GalleryArrowDirection } from "../GalleryArrow.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { AllChartsListItem } from "./AllChartsListItem.js"

export const ALL_CHARTS_CLASS_NAME = "wp-block-all-charts"

export const AllCharts = ({ charts }: { charts: RelatedChart[] }) => {
    const [isGalleryOpen, setGalleryOpen] = useState(false)
    const [activeSlide, setActiveSlide] = useState(0)

    const isFirstSlideActive = activeSlide === 0
    const isLastSlideActive = activeSlide === charts.length - 1

    const onClickItem = (event: React.MouseEvent, idx: number) => {
        // Allow opening charts in new tab/window with ⌘+CLICK
        if (!event.metaKey && !event.shiftKey && !event.ctrlKey) {
            event.preventDefault()
            setActiveSlide(idx)
            setGalleryOpen(!isGalleryOpen)
        }
    }

    const filterFnIsKeyChart = (isKey: boolean) => (chart: RelatedChart) =>
        isKey ? chart.isKey : !chart.isKey

    const keyCharts = charts.filter(filterFnIsKeyChart(true))

    const standardCharts = charts.filter(filterFnIsKeyChart(false))

    return (
        <div className={ALL_CHARTS_CLASS_NAME}>
            <ul className="key">
                {keyCharts.map((chart, idx) => (
                    <AllChartsListItem
                        chart={chart}
                        key={chart.slug}
                        onClick={(e) => onClickItem(e, idx)}
                    />
                ))}
            </ul>
            <ul>
                {standardCharts.map((chart, idx) => (
                    <AllChartsListItem
                        chart={chart}
                        key={chart.slug}
                        onClick={(e) => onClickItem(e, idx + keyCharts.length)}
                    />
                ))}
            </ul>
            {isGalleryOpen && (
                <Modal onClose={() => setGalleryOpen(false)}>
                    <div className="all-charts-gallery">
                        <div className="navigation-wrapper">
                            <div className="close">
                                <button
                                    aria-label="Close"
                                    onClick={() => setGalleryOpen(false)}
                                    className="close"
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                            <div className="navigation">
                                <GalleryArrow
                                    disabled={isFirstSlideActive}
                                    onClick={() =>
                                        setActiveSlide(activeSlide - 1)
                                    }
                                    direction={GalleryArrowDirection.prev}
                                ></GalleryArrow>
                                <div className="gallery-pagination">
                                    Chart {activeSlide + 1} of {charts.length}
                                </div>
                                <GalleryArrow
                                    disabled={isLastSlideActive}
                                    onClick={() =>
                                        setActiveSlide(activeSlide + 1)
                                    }
                                    direction={GalleryArrowDirection.next}
                                ></GalleryArrow>
                            </div>
                        </div>
                        <iframe
                            src={`/grapher/${
                                keyCharts.concat(standardCharts)[activeSlide]
                                    .slug
                            }`}
                            loading="lazy"
                            data-possibly-with-context
                        />
                    </div>
                </Modal>
            )}
        </div>
    )
}

export const runAllCharts = (charts: RelatedChart[]) => {
    const relatedChartsEl = document.querySelector<HTMLElement>(
        `.${ALL_CHARTS_CLASS_NAME}`
    )
    if (relatedChartsEl) {
        const relatedChartsWrapper = relatedChartsEl.parentElement
        ReactDOM.hydrate(<AllCharts charts={charts} />, relatedChartsWrapper)
    }
}
