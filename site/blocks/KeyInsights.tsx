import React, { useCallback, useContext, useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { KeyInsight } from "../../clientUtils/owidTypes.js"
import { getWindowUrl, setWindowUrl } from "../../clientUtils/urls/Url.js"

export const KEY_INSIGHTS_CLASS_NAME = "wp-block-owid-key-insights"
export const KEY_INSIGHTS_INSIGHT_PARAM = "insight"
export const KEY_INSIGHTS_THUMBS_CLASS_NAME = "thumbs"
export const KEY_INSIGHTS_THUMB_CLASS_NAME = "thumb"
export const KEY_INSIGHTS_SLIDES_CLASS_NAME = "slides"
export const KEY_INSIGHTS_SLIDE_CLASS_NAME = "slide"
export const KEY_INSIGHTS_SLIDE_CONTENT_CLASS_NAME = "content"

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
            role="tab"
            aria-selected={selected}
            className={KEY_INSIGHTS_THUMB_CLASS_NAME}
        >
            {title}
        </button>
    )
}

/**
 * Tab-based switcher for key insights
 *
 * NB: this component has only received limited efforts towards accessibility.
 *
 * A next possible step would be to managage focus via arrow keys (see
 * https://w3c.github.io/aria/#managingfocus). A good implementation of
 * accessibility practices for this kind of widget is available at
 * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tab_role
 */
export const KeyInsightsThumbs = ({ titles }: { titles: string[] }) => {
    const [selectedId, setSelectedId] = useState<string>("0")
    const [slides, setSlides] = useState<HTMLElement | null>(null)
    const [slug, setSlug] = useState<string>("")
    const apiRef = React.useRef({} as scrollVisibilityApiType)

    // Not using useRef() here so that the  "select slide based on hash" effect,
    // running on page load only, runs after the ref has been attached (and not
    // on first render, which would be before)
    // https://reactjs.org/docs/hooks-faq.html#how-can-i-measure-a-dom-node
    const thumbsRef = useCallback((node) => {
        if (node !== null) {
            const keyInsightsNode = node.parentElement?.parentElement

            setSlides(
                keyInsightsNode?.querySelector(
                    `.${KEY_INSIGHTS_SLIDES_CLASS_NAME}`
                )
            )
            // get slug from previous <h3>
            setSlug(keyInsightsNode?.previousElementSibling?.getAttribute("id"))
        }
    }, [])

    // Select active slide based on URL
    useEffect(() => {
        if (!slides) return

        const windowUrl = getWindowUrl()
        if (!windowUrl.queryParams.insight) return

        // find the slide containing the h4 with the id matching the ?insight query param
        const selectedSlideIdx = Array.from(
            slides.querySelectorAll(`.${KEY_INSIGHTS_SLIDE_CLASS_NAME}`)
        ).findIndex((slide) =>
            slide.querySelector(
                `#${windowUrl.queryParams[KEY_INSIGHTS_INSIGHT_PARAM]}`
            )
        )

        if (selectedSlideIdx === -1) return
        setSelectedId(selectedSlideIdx.toString())
    }, [slides])

    // Scroll to selected item
    useEffect(() => {
        const item = apiRef.current.getItemById(selectedId)
        if (!item) return

        apiRef.current.scrollToItem(item, "smooth", "center", "nearest")
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
                    const windowUrl = getWindowUrl()
                    const anchor = slide.querySelector("h4")?.getAttribute("id")
                    if (!anchor) return
                    setWindowUrl(
                        windowUrl
                            .updateQueryParams({
                                [KEY_INSIGHTS_INSIGHT_PARAM]: anchor,
                            })
                            // When a key insight slug is changed, links
                            // pointing to that key insight soft-break and take
                            // readers to the top of the page. Adding an anchor
                            // pointing to the the block title (h3) serves as a
                            // stopgap, taking readers to the key insights block
                            // instead but without selecting a particular
                            // insight.
                            //
                            // This also improves the UX of readers coming
                            // through shared insights URL. e.g.
                            // /key-insights-demo?insight=insight-1#key-insights
                            // shows the whole insights block, including its
                            // titles (the target of the anchor).
                            .update({ hash: `#${slug}` })
                    )
                } else {
                    slide.setAttribute("data-active", "false")
                }
            })
    }, [selectedId])

    return (
        <div
            className={KEY_INSIGHTS_THUMBS_CLASS_NAME}
            role="tablist"
            ref={thumbsRef}
        >
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
                            onClick={() => {
                                setSelectedId(itemId)
                            }}
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
        {insights.map(({ title, isTitleHidden, slug, content }, idx) => (
            <div
                key={idx}
                className={KEY_INSIGHTS_SLIDE_CLASS_NAME}
                data-active={idx === 0}
                role="tabpanel"
                tabIndex={0}
            >
                <h4 style={isTitleHidden ? { display: "none" } : {}} id={slug}>
                    {title}
                </h4>
                <div
                    className={KEY_INSIGHTS_SLIDE_CONTENT_CLASS_NAME}
                    dangerouslySetInnerHTML={{ __html: content }}
                />
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
        .querySelectorAll<HTMLElement>(
            `.${KEY_INSIGHTS_CLASS_NAME} .${KEY_INSIGHTS_THUMBS_CLASS_NAME}`
        )
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
