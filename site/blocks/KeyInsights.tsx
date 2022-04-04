import React, { useContext, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { useEmbedChart } from "../hooks.js"
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"

export const CLASS_NAME = "key-insights"
const THUMB_CLASS_NAME = "thumb"
const SLIDE_CLASS_NAME = "slide"
const SLIDES_ID = "key-insights-slides"

type scrollVisibilityApiType = React.ContextType<typeof VisibilityContext>

const Thumb = ({
    title,
    onClick,
    selected,
}: {
    title: string
    itemId: string
    onClick: (visibility: scrollVisibilityApiType) => void
    selected: boolean
}) => {
    const visibility = useContext(VisibilityContext)

    return (
        <button
            onClick={() => onClick(visibility)}
            className={
                selected ? `${THUMB_CLASS_NAME} selected` : THUMB_CLASS_NAME
            }
        >
            {title}
        </button>
    )
}

export const KeyInsights = ({ titles }: { titles: string[] }) => {
    const [selectedId, setSelectedId] = useState<string>("0")
    const refChartContainer = useRef<HTMLDivElement>(null)

    const handleThumbClickFactory = (itemId: string) => {
        return ({ scrollToItem, getItemById }: scrollVisibilityApiType) => {
            setSelectedId(itemId)
            scrollToItem(getItemById(itemId), "smooth", "center", "nearest")
        }
    }

    useEmbedChart(selectedId, refChartContainer)

    useEffect(() => {
        // Only handle one KeyInsight block per page
        const slides = document.getElementById(SLIDES_ID)
        if (!slides) return

        // A less imperative, more React way to do this would be preferred. To
        // switch between slides, I aimed to keep their content untouched
        // (including event listeners hydrated by other components), while only
        // updating their wrappers. Managing the switching logic through React
        // would have required hydrating Slides as well as all possible content
        // components within them - even though they would have been already
        // hydrated at the page level. From that perspective, the gain is not
        // clear, and the approach not necessarily cleaner, so I stuck with the
        // imperative approach.

        slides
            .querySelectorAll(`.${SLIDE_CLASS_NAME}`)
            .forEach((slide, idx) => {
                if (idx === Number(selectedId)) {
                    slide.setAttribute("data-active", "true")
                } else {
                    slide.removeAttribute("data-active")
                }
            })
    }, [selectedId])

    return (
        <div className={CLASS_NAME}>
            <div className="thumbs">
                <ScrollMenu
                    LeftArrow={LeftArrow}
                    RightArrow={RightArrow}
                    transitionDuration={200}
                >
                    {titles.map((title, i) => {
                        const itemId = `${i}`
                        return (
                            <Thumb
                                title={title}
                                key={itemId}
                                itemId={itemId}
                                onClick={handleThumbClickFactory(itemId)}
                                selected={itemId === selectedId}
                            />
                        )
                    })}
                </ScrollMenu>
            </div>
        </div>
    )
}

export const Slides = ({ slides }: { slides: string[] }) => (
    <div id={SLIDES_ID}>
        {slides.map((slide, idx) => (
            <div
                key={idx}
                className={SLIDE_CLASS_NAME}
                dangerouslySetInnerHTML={{ __html: slide }}
            ></div>
        ))}
    </div>
)

const Arrow = ({
    children,
    disabled,
    onClick,
    className,
}: {
    children: React.ReactNode
    disabled: boolean
    onClick: VoidFunction
    className?: string
}) => {
    const classes = ["arrow", className]
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={classes.join(" ")}
        >
            {children}
        </button>
    )
}

const LeftArrow = () => {
    const {
        isFirstItemVisible,
        scrollPrev,
        visibleItemsWithoutSeparators,
        initComplete,
    } = React.useContext(VisibilityContext)

    const [disabled, setDisabled] = React.useState(
        !initComplete || (initComplete && isFirstItemVisible)
    )
    React.useEffect(() => {
        // NOTE: detect if whole component visible
        if (visibleItemsWithoutSeparators.length) {
            setDisabled(isFirstItemVisible)
        }
    }, [isFirstItemVisible, visibleItemsWithoutSeparators])

    return !disabled ? (
        <Arrow disabled={false} onClick={() => scrollPrev()} className="left">
            <FontAwesomeIcon icon={faAngleRight} flip="horizontal" />
        </Arrow>
    ) : null
}

const RightArrow = () => {
    const { isLastItemVisible, scrollNext, visibleItemsWithoutSeparators } =
        React.useContext(VisibilityContext)

    const [disabled, setDisabled] = React.useState(
        !visibleItemsWithoutSeparators.length && isLastItemVisible
    )
    React.useEffect(() => {
        if (visibleItemsWithoutSeparators.length) {
            setDisabled(isLastItemVisible)
        }
    }, [isLastItemVisible, visibleItemsWithoutSeparators])

    return !disabled ? (
        <Arrow disabled={false} onClick={() => scrollNext()} className="right">
            <FontAwesomeIcon icon={faAngleRight} />
        </Arrow>
    ) : null
}

export const hydrateKeyInsights = () => {
    // Only handle one KeyInsight block per page
    const block = document.querySelector<HTMLElement>(`.${CLASS_NAME}`)
    if (!block) return
    const titles = Array.from(
        block.querySelectorAll(`.${THUMB_CLASS_NAME}`)
    ).map((thumb) => thumb.innerHTML)

    const blockWrapper = block.parentElement
    ReactDOM.hydrate(<KeyInsights titles={titles} />, blockWrapper)
}
