import * as React from "react"
import { Button } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons"
import {
    Slide,
    SlideTemplate,
    SLIDE_TEMPLATE_LABELS,
} from "@ourworldindata/types"
import { match } from "ts-pattern"
import { parseSlideChartUrl } from "../../site/slideshows/slideshowUtils.js"

/** Truncate a string and strip markdown formatting for display */
function truncate(text: string, maxLength: number = 50): string {
    const plain = text.replace(/[*_#[\]()]/g, "").trim()
    if (plain.length <= maxLength) return plain
    return plain.slice(0, maxLength).trim() + "…"
}

function getSlideName(slide: Slide, index: number): string {
    const fallback = `Slide ${index + 1}`
    return match(slide)
        .with({ template: SlideTemplate.Cover }, (s) => s.title || fallback)
        .with(
            { template: SlideTemplate.Image },
            (s) => s.slideTitle || s.filename || fallback
        )
        .with({ template: SlideTemplate.Chart }, (s) => {
            if (s.title) return s.title
            if (s.url) return parseSlideChartUrl(s.url).slug
            return fallback
        })
        .with({ template: SlideTemplate.TwoCharts }, (s) => {
            if (s.title) return s.title
            const slugs = [s.url1, s.url2]
                .filter(Boolean)
                .map((url) => parseSlideChartUrl(url).slug)
            return slugs.length > 0 ? slugs.join(" + ") : fallback
        })
        .with(
            { template: SlideTemplate.Statement },
            (s) => truncate(s.text) || fallback
        )
        .with({ template: SlideTemplate.Outline }, (s) => s.title || fallback)
        .with(
            { template: SlideTemplate.Text },
            (s) => s.title || truncate(s.text) || fallback
        )
        .exhaustive()
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
