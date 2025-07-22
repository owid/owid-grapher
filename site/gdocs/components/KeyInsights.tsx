import { useCallback, useContext, useEffect, useState } from "react"
import * as React from "react"
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import {
    getWindowUrl,
    setWindowUrl,
    EnrichedBlockKeyInsightsSlide,
    slugify,
    KEY_INSIGHTS_ID,
} from "@ourworldindata/utils"

import { ArticleBlocks } from "./ArticleBlocks.js"
import Image from "./Image.js"
import Chart from "./Chart.js"
import NarrativeChart from "./NarrativeChart.js"

export const KEY_INSIGHTS_CLASS_NAME = "key-insights"
export const KEY_INSIGHTS_INSIGHT_PARAM = "insight"
const KEY_INSIGHTS_THUMBS_CLASS_NAME = "thumbs"
const KEY_INSIGHTS_THUMB_CLASS_NAME = "thumb"
const KEY_INSIGHTS_SLIDES_CLASS_NAME = "slides"
const KEY_INSIGHTS_SLIDE_CLASS_NAME = "slide"
const KEY_INSIGHTS_SLIDE_CONTENT_CLASS_NAME = "content"

type scrollVisibilityApiType = React.ContextType<typeof VisibilityContext>

enum ArrowDirection {
    prev = "prev",
    next = "next",
}

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
            aria-label={`Go to slide: ${title}`}
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
    const thumbsRef: React.RefCallback<HTMLDivElement> = useCallback((node) => {
        if (node !== null) {
            const keyInsightsNode = node.parentElement?.parentElement

            const tempSlides = keyInsightsNode?.querySelector(
                `.${KEY_INSIGHTS_SLIDES_CLASS_NAME}`
            ) as HTMLDivElement | null
            setSlides(tempSlides)
            // get slug from previous <h3>
            setSlug(
                keyInsightsNode?.previousElementSibling?.getAttribute("id") ??
                    ""
            )
        }
    }, [])

    // Select active slide based on URL
    useEffect(() => {
        if (!slides) return

        const insightParam =
            getWindowUrl().queryParams[KEY_INSIGHTS_INSIGHT_PARAM]
        if (!insightParam) return

        const selectedSlideIdx = Array.from(
            slides.querySelectorAll(`.${KEY_INSIGHTS_SLIDE_CLASS_NAME}`)
        ).findIndex((slide) => {
            // Since query params are a form of user input, the selector might
            // not be valid.
            try {
                return slide.querySelector(`#${insightParam}`)
            } catch {
                return false
            }
        })

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
                    if (
                        !anchor ||
                        windowUrl.queryParams[KEY_INSIGHTS_INSIGHT_PARAM] ===
                            anchor
                    )
                        return
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
        // see https://github.com/owid/owid-grapher/pull/1435#discussion_r888058198
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

const Arrow = ({
    children,
    disabled,
    onClick,
    className,
    direction,
}: {
    children: React.ReactNode
    disabled: boolean
    onClick: VoidFunction
    className?: string
    direction: ArrowDirection
}) => {
    const classes = ["arrow", className]
    return (
        <button
            aria-label={`Scroll to ${
                direction === ArrowDirection.next ? "next" : "previous"
            } slide`}
            disabled={disabled}
            onClick={onClick}
            className={classes.join(" ")}
        >
            {children}
        </button>
    )
}

const LeftArrow = () => {
    const { useLeftArrowVisible, scrollPrev } = useContext(VisibilityContext)

    const disabled = useLeftArrowVisible()

    return (
        !disabled && (
            <Arrow
                disabled={false}
                onClick={() => scrollPrev()}
                className="left"
                direction={ArrowDirection.prev}
            >
                <FontAwesomeIcon icon={faAngleRight} flip="horizontal" />
            </Arrow>
        )
    )
}

const RightArrow = () => {
    const { useRightArrowVisible, scrollNext } = useContext(VisibilityContext)

    const disabled = useRightArrowVisible()

    return (
        !disabled && (
            <Arrow
                disabled={false}
                onClick={() => scrollNext()}
                className="right"
                direction={ArrowDirection.next}
            >
                <FontAwesomeIcon icon={faAngleRight} />
            </Arrow>
        )
    )
}

type KeyInsightsProps = {
    className?: string
    insights: EnrichedBlockKeyInsightsSlide[]
    heading: string
}

export const KeyInsights = ({
    insights,
    heading,
    className,
}: KeyInsightsProps) => {
    function renderAssetForInsight({
        filename,
        url,
        narrativeChartName,
    }: {
        filename?: string
        url?: string
        narrativeChartName?: string
    }): React.ReactElement | null {
        if (filename) {
            return (
                <Image
                    filename={filename}
                    containerType="sticky-right-left-column"
                />
            )
        }
        if (url) {
            return (
                <Chart
                    d={{ url, type: "chart", parseErrors: [] }}
                    fullWidthOnMobile={true}
                />
            )
        }
        if (narrativeChartName) {
            return (
                <NarrativeChart
                    d={{
                        name: narrativeChartName,
                        type: "narrative-chart",
                        parseErrors: [],
                    }}
                    fullWidthOnMobile={true}
                />
            )
        }

        return null
    }
    return (
        <div className={className}>
            <h1
                className="article-block__heading h1-semibold"
                id={KEY_INSIGHTS_ID}
            >
                <span>{heading}</span>
                <a
                    className="deep-link"
                    aria-labelledby={KEY_INSIGHTS_ID}
                    href={`#${KEY_INSIGHTS_ID}`}
                />
            </h1>
            <div className={KEY_INSIGHTS_CLASS_NAME}>
                <div>
                    <KeyInsightsThumbs
                        titles={insights.map(({ title }) => title)}
                    />
                    <div className={KEY_INSIGHTS_SLIDES_CLASS_NAME}>
                        {insights.map(
                            (
                                {
                                    title,
                                    content,
                                    filename,
                                    url,
                                    narrativeChartName,
                                },
                                idx
                            ) => {
                                return (
                                    <div
                                        key={idx}
                                        className={cx(
                                            KEY_INSIGHTS_SLIDE_CLASS_NAME,
                                            "grid grid-cols-12 span-cols-12"
                                        )}
                                        data-active={idx === 0}
                                        role="tabpanel"
                                        tabIndex={0}
                                    >
                                        <div className="grid span-cols-12">
                                            <div className="article-block__key-insights-content-column span-cols-5 span-md-cols-12">
                                                <h4
                                                    id={slugify(title)}
                                                    className="key-insights-title"
                                                >
                                                    {title}
                                                </h4>
                                                <div
                                                    className={
                                                        KEY_INSIGHTS_SLIDE_CONTENT_CLASS_NAME
                                                    }
                                                >
                                                    <ArticleBlocks
                                                        blocks={content}
                                                        containerType="key-insight"
                                                    />
                                                </div>
                                            </div>
                                            <div className="key-insight__asset-container span-cols-7 span-md-cols-12">
                                                {renderAssetForInsight({
                                                    filename,
                                                    url,
                                                    narrativeChartName,
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
