import React from "react"
import ReactDOM from "react-dom"
import { useState } from "react"
import { RelatedChart } from "../../clientUtils/owidTypes.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../../settings/clientSettings.js"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "../../grapher/core/GrapherConstants.js"
import { Modal } from "../Modal.js"
import { GalleryArrow, GalleryArrowDirection } from "../GalleryArrow.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const ALL_CHARTS_CLASS_NAME = "wp-block-all-charts"

export const AllCharts = ({ charts }: { charts: RelatedChart[] }) => {
    const [isGalleryOpen, setGalleryOpen] = useState(false)
    const [activeSlide, setActiveSlide] = useState(0)

    const isFirstSlideActive = activeSlide === 0
    const isLastSlideActive = activeSlide === charts.length - 1

    return (
        <div className={ALL_CHARTS_CLASS_NAME}>
            <ul>
                {charts.map((chart, idx) => (
                    <li key={chart.slug}>
                        <a
                            href={`/grapher/${chart.slug}`}
                            onClick={(event) => {
                                // Allow opening charts in new tab/window with ⌘+CLICK
                                if (
                                    !event.metaKey &&
                                    !event.shiftKey &&
                                    !event.ctrlKey
                                ) {
                                    event.preventDefault()
                                    setActiveSlide(idx)
                                    setGalleryOpen(!isGalleryOpen)
                                }
                            }}
                        >
                            <img
                                src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chart.slug}.svg`}
                                loading="lazy"
                                data-no-lightbox
                                data-no-img-formatting
                                width={DEFAULT_GRAPHER_WIDTH}
                                height={DEFAULT_GRAPHER_HEIGHT}
                            ></img>
                            <span>{chart.title}</span>
                        </a>
                        {chart.variantName ? (
                            <span className="variantName">
                                {chart.variantName}
                            </span>
                        ) : null}
                    </li>
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
                            src={`/grapher/${charts[activeSlide].slug}`}
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
