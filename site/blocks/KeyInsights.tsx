import React, { useContext, useEffect, useRef, useState } from "react"
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
export const KEY_INSIGHTS_SLIDE_CONENT_CLASS_NAME = "content"

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
    const thumbsRef = useRef<HTMLDivElement>(null)

    const handleThumbClickFactory = (itemId: string) => {
        return ({ scrollToItem, getItemById }: scrollVisibilityApiType) => {
            setSelectedId(itemId)
            scrollToItem(getItemById(itemId), "smooth", "center", "nearest")
        }
    }

    useEffect(() => {
        const slides =
            thumbsRef.current?.parentElement?.parentElement?.querySelector(
                `.${KEY_INSIGHTS_SLIDES_CLASS_NAME}`
            )
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
                } else {
                    slide.removeAttribute("data-active")
                }
            })
    }, [selectedId])

    return (
        <div className={KEY_INSIGHTS_THUMBS_CLASS_NAME} ref={thumbsRef}>
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
    )
}

export const KeyInsightsSlides = ({ insights }: { insights: KeyInsight[] }) => (
    <div className={KEY_INSIGHTS_SLIDES_CLASS_NAME}>
        {insights.map(({ title, content, slug }, idx) => (
            <div key={idx} className={KEY_INSIGHTS_SLIDE_CLASS_NAME}>
                <h4>
                    <a href={`/${slug}`}>{title}</a>
                </h4>
                <div
                    className={KEY_INSIGHTS_SLIDE_CONENT_CLASS_NAME}
                    dangerouslySetInnerHTML={{ __html: content }}
                ></div>
            </div>
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
    document
        .querySelectorAll<HTMLElement>(`.${KEY_INSIGHTS_THUMBS_CLASS_NAME}`)
        .forEach((block) => {
            const titles = Array.from(
                block.querySelectorAll(`.${KEY_INSIGHTS_THUMB_CLASS_NAME}`)
            ).map((thumb) => thumb.innerHTML)

            if (!titles.length) return

            const blockWrapper = block.parentElement
            ReactDOM.hydrate(
                <KeyInsightsThumbs titles={titles} />,
                blockWrapper
            )
        })
}
