import * as React from "react"
import { Button } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons"
import {
    Slide,
    SlideTemplate,
    SLIDE_TEMPLATE_LABELS,
} from "@ourworldindata/types"

function getSlideName(slide: Slide, index: number): string {
    switch (slide.template) {
        case SlideTemplate.Cover:
            return slide.title || `Slide ${index + 1}`
        case SlideTemplate.Section:
            return slide.title || `Slide ${index + 1}`
        default:
            return `Slide ${index + 1}`
    }
}

export function SlideshowArrangeTab(props: {
    slides: Slide[]
    currentSlideIndex: number
    onReorder: (slides: Slide[]) => void
    onSelect: (index: number) => void
    onDirty: () => void
}): React.ReactElement {
    const { slides, currentSlideIndex, onReorder, onSelect, onDirty } = props

    const moveSlide = (fromIndex: number, direction: "up" | "down") => {
        const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1
        if (toIndex < 0 || toIndex >= slides.length) return

        const next = [...slides]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        onReorder(next)
        onSelect(toIndex)
        onDirty()
    }

    return (
        <div className="SlideshowArrangeTab">
            <h3>Arrange Slides</h3>
            <div className="SlideshowArrangeTab__list">
                {slides.map((slide, i) => (
                    <div
                        key={i}
                        className={`SlideshowArrangeTab__item ${
                            i === currentSlideIndex
                                ? "SlideshowArrangeTab__item--active"
                                : ""
                        }`}
                        onClick={() => onSelect(i)}
                    >
                        <div className="SlideshowArrangeTab__item-thumbnail" />
                        <div className="SlideshowArrangeTab__item-info">
                            <span className="SlideshowArrangeTab__item-name">
                                {getSlideName(slide, i)}
                            </span>
                            <span className="SlideshowArrangeTab__item-type">
                                {SLIDE_TEMPLATE_LABELS[slide.template]}
                            </span>
                        </div>
                        <div className="SlideshowArrangeTab__item-actions">
                            <Button
                                size="small"
                                disabled={i === 0}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    moveSlide(i, "up")
                                }}
                            >
                                <FontAwesomeIcon icon={faChevronUp} />
                            </Button>
                            <Button
                                size="small"
                                disabled={i === slides.length - 1}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    moveSlide(i, "down")
                                }}
                            >
                                <FontAwesomeIcon icon={faChevronDown} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
