import React, { useCallback, useContext, useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { KeyInsight } from "../../clientUtils/owidTypes.js"

export const KEY_INSIGHTS_CLASS_NAME = "key-insights"
export const KEY_INSIGHTS_THUMBS_CLASS_NAME = "thumbs"
const KEY_INSIGHTS_THUMB_CLASS_NAME = "thumb"
const KEY_INSIGHTS_SLIDES_CLASS_NAME = "slides"
export const KEY_INSIGHTS_SLIDE_CLASS_NAME = "slide"

type scrollVisibilityApiType = React.ContextType<typeof VisibilityContext>

const Thumb = ({
    title,
    onClick,
    selected,
}: {
    title: string
    onClick: () => void
    itemId: string // needed by react-horizontal-scrolling-menu, see lib's examples
    selected: boolean
}) => {
    return (
        <button
            onClick={onClick}
            className={
                selected
                    ? `${KEY_INSIGHTS_THUMB_CLASS_NAME} selected`
                    : KEY_INSIGHTS_THUMB_CLASS_NAME
            }
        >
            {title}
        </button>
    )
}

export const KeyInsightsThumbs = ({ titles }: { titles: string[] }) => {
    const [selectedId, setSelectedId] = useState<string>("0")
    const [slides, setSlides] = useState<HTMLElement | null>(null)
    const apiRef = React.useRef({} as scrollVisibilityApiType)

    // Not using useRef() here so that the  "select slide based on hash" effect,
    // running on page load only, runs after the ref has been attached (and not
    // on first render, which would be before)
    // https://reactjs.org/docs/hooks-faq.html#how-can-i-measure-a-dom-node
    const thumbsRef = useCallback((node) => {
        if (node !== null) {
            setSlides(
                node.parentElement?.parentElement?.querySelector(
                    `.${KEY_INSIGHTS_SLIDES_CLASS_NAME}`
                )
            )
        }
    }, [])

    // Select active slide based on URL fragment
    useEffect(() => {
        if (!slides) return

        const hash = document.location.hash
        if (!hash) return

        const selectedSlideIdx = Array.from(
            slides.querySelectorAll(`.${KEY_INSIGHTS_SLIDE_CLASS_NAME}`)
        ).findIndex((slide) => slide.querySelector(hash))

        if (selectedSlideIdx === -1) return
        setSelectedId(selectedSlideIdx.toString())
    }, [slides])

    // Scroll to selected item
    useEffect(() => {
        const itemElement = apiRef.current.getItemElementById(selectedId)
        if (!itemElement) return

        apiRef.current.scrollToItem(itemElement, "smooth", "center", "nearest")
    }, [selectedId])

    // Select active slide when corresponding thumb selected
    useEffect(() => {
        if (!slides) return

        // A less imperative, more React way to do this would be preferred. To
        // switch between slides, I aimed to keep their content untouched
        // (including event listeners hydrated by other components), while only
        // updating their wrappers. Managing the switching logic through React
        // would have required hydrating KeyInsightsSlides as well as all
        // possible content components within them - even though they would have
        // been already hydrated at the page level. From that perspective, the
        // gain is not clear, and the approach not necessarily cleaner, so I
        // stuck with the imperative approach.

        slides
            .querySelectorAll(`.${KEY_INSIGHTS_SLIDE_CLASS_NAME}`)
            .forEach((slide, idx) => {
                if (idx === Number(selectedId)) {
                    slide.setAttribute("data-active", "true")
                    const anchor = slide.querySelector("h4")?.getAttribute("id")
                    if (anchor) history.replaceState(null, "", `#${anchor}`)
                } else {
                    slide.setAttribute("data-active", "false")
                }
            })
    }, [selectedId])

    return (
        <div className={KEY_INSIGHTS_THUMBS_CLASS_NAME} ref={thumbsRef}>
            <ScrollMenu
                LeftArrow={LeftArrow}
                RightArrow={RightArrow}
                transitionDuration={200}
                apiRef={apiRef}
            >
                {titles.map((title, i) => {
                    const itemId = `${i}`
                    return (
                        <Thumb
                            title={title}
                            key={itemId}
                            itemId={itemId}
                            onClick={() => setSelectedId(itemId)}
                            selected={itemId === selectedId}
                        />
                    )
                })}
            </ScrollMenu>
        </div>
    )
}

export const KeyInsightsSlides = ({ insights }: { insights: KeyInsight[] }) => (
    <div className={KEY_INSIGHTS_SLIDES_CLASS_NAME}>
        {insights.map(({ content }, idx) => (
            <div
                key={idx}
                className={KEY_INSIGHTS_SLIDE_CLASS_NAME}
                data-active={idx === 0}
                dangerouslySetInnerHTML={{ __html: content }}
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
    } = useContext(VisibilityContext)

    const [disabled, setDisabled] = useState(
        !initComplete || (initComplete && isFirstItemVisible)
    )
    useEffect(() => {
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
        useContext(VisibilityContext)

    const [disabled, setDisabled] = useState(
        !visibleItemsWithoutSeparators.length && isLastItemVisible
    )
    useEffect(() => {
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
    document
        .querySelectorAll<HTMLElement>(`.${KEY_INSIGHTS_THUMBS_CLASS_NAME}`)
        .forEach((block) => {
            const titles = Array.from(
                block.querySelectorAll(`.${KEY_INSIGHTS_THUMB_CLASS_NAME}`)
            ).map((thumb) => thumb.textContent || "")

            if (!titles.length) return

            const blockWrapper = block.parentElement
            ReactDOM.hydrate(
                <KeyInsightsThumbs titles={titles} />,
                blockWrapper
            )
        })
}
