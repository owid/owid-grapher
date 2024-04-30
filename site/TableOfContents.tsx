import React, { useState, useEffect, useRef, useCallback } from "react"
import ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowUp, faBars, faTimes } from "@fortawesome/free-solid-svg-icons"
import { useScrollDirection, useTriggerWhenClickOutside } from "./hooks.js"
import { wrapInDiv, TocHeading } from "@ourworldindata/utils"
import cx from "classnames"

const TOC_WRAPPER_CLASSNAME = "toc-wrapper"

interface TableOfContentsData {
    headings: TocHeading[]
    pageTitle: string
    hideSubheadings?: boolean
    headingLevels?: {
        primary: number
        secondary: number
    }
}

const isRecordTopViewport = (record: IntersectionObserverEntry) => {
    return (
        record.rootBounds &&
        record.boundingClientRect.top < record.rootBounds.height / 2
    )
}

const getPreviousHeading = (
    nextHeadingRecord: IntersectionObserverEntry | undefined,
    previousHeadings: Array<{ slug: string; previous: string | null }>
) => {
    return previousHeadings.find(
        (heading) => heading.slug === nextHeadingRecord?.target.id
    )?.previous
}

export const TableOfContents = ({
    headings,
    pageTitle,
    hideSubheadings,
    // Original WP articles used a hierarchy of h2 and h3 headings
    // New Gdoc articles use a hierarchy of h1 and h2 headings
    headingLevels = {
        primary: 2,
        secondary: 3,
    },
}: TableOfContentsData) => {
    const [isOpen, setIsOpen] = useState(false)
    const [activeHeading, setActiveHeading] = useState<TocHeading | null>(null)
    const { primary, secondary } = headingLevels
    const tocRef = useRef<HTMLElement>(null)

    const toggleIsOpen = () => {
        setIsOpen(!isOpen)
    }

    const close = () => {
        setIsOpen(false)
    }
    // The Gdocs sidebar can't rely on the same CSS logic that old-style entries use, so we need to
    // explicitly trigger these toggles based on screen width
    // const toggleIsOpenOnMobile = () => {
    //     if (window.innerWidth < 1536) {
    //         toggleIsOpen()
    //     }
    // }

    const setActiveHeadingFromSlug = useCallback(
        (slug: string) => {
            // Find the heading with the given slug
            const heading = headings.find((h) => h.slug === slug)
            if (!heading) {
                setActiveHeading(null)
                return
            }
            setActiveHeading(heading)
        },
        [headings]
    )

    useTriggerWhenClickOutside(tocRef, isOpen, setIsOpen)

    const scrollDirection = useScrollDirection()

    // Open the sidebar on desktop by default when mounting
    useEffect(() => {
        setIsOpen(window.innerWidth >= 1536)
    }, [])

    useEffect(() => {
        if ("IntersectionObserver" in window) {
            const previousHeadings = headings.map((heading, i) => ({
                slug: heading.slug,
                previous: i > 0 ? headings[i - 1].slug : null,
            }))

            let currentHeadingRecord: IntersectionObserverEntry | undefined
            let init = true

            const observer = new IntersectionObserver(
                (records) => {
                    let nextHeadingRecord: IntersectionObserverEntry | undefined

                    // Target headings going down
                    currentHeadingRecord = records.find(
                        (record) =>
                            // filter out records no longer intersecting (triggering on exit)
                            record.isIntersecting &&
                            // filter out records fully in the page (upcoming section)
                            record.intersectionRatio !== 1 &&
                            // filter out intersections happening at the bottom of the viewport
                            isRecordTopViewport(record)
                    )

                    if (currentHeadingRecord) {
                        setActiveHeadingFromSlug(currentHeadingRecord.target.id)
                    } else {
                        // Target headings going up
                        nextHeadingRecord = records.find(
                            (record) =>
                                isRecordTopViewport(record) &&
                                record.intersectionRatio === 1
                        )
                        if (nextHeadingRecord) {
                            setActiveHeadingFromSlug(
                                getPreviousHeading(
                                    nextHeadingRecord,
                                    previousHeadings
                                ) || ""
                            )
                        } else if (init) {
                            currentHeadingRecord = records
                                .reverse()
                                .find(
                                    (record) =>
                                        record.boundingClientRect.top < 0
                                )
                            setActiveHeadingFromSlug(
                                currentHeadingRecord?.target.id || ""
                            )
                        }
                    }
                    init = false
                },
                {
                    rootMargin: "-90px", // 10px offset to trigger intersection when landing exactly at the border when clicking an anchor
                    threshold: new Array(11).fill(0).map((v, i) => i / 10),
                }
            )

            let contentHeadings = null
            // In Gdocs articles, these sections are ID'd via unique elements
            const appendixDivs =
                ", h3#article-endnotes, section#article-citation, section#article-licence"
            if (hideSubheadings) {
                contentHeadings = document.querySelectorAll(
                    `h${secondary} ${appendixDivs}`
                )
            } else {
                contentHeadings = document.querySelectorAll(
                    `h${primary}, h${secondary} ${appendixDivs}`
                )
            }
            contentHeadings.forEach((contentHeading) => {
                observer.observe(contentHeading)
            })

            return () => observer.disconnect()
        }
        return
    }, [
        headings,
        hideSubheadings,
        setActiveHeadingFromSlug,
        primary,
        secondary,
    ])

    return (
        <div
            className={cx(
                TOC_WRAPPER_CLASSNAME,
                "grid span-cols-14 grid-cols-12-full-width",
                {
                    [`${TOC_WRAPPER_CLASSNAME}--sticky`]:
                        (scrollDirection === "up" && activeHeading) || isOpen,
                    [`${TOC_WRAPPER_CLASSNAME}--closed`]: !isOpen,
                }
            )}
        >
            <aside
                className={cx(
                    "table-of-contents",
                    {
                        "table-of-contents--open": isOpen,
                    },
                    "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2"
                )}
                ref={tocRef}
            >
                <div className="toc-header">
                    {isOpen ? (
                        <h3 className="toc-header__page-title">
                            <a href="#" onClick={close}>
                                {pageTitle}
                            </a>
                        </h3>
                    ) : (
                        <div className="toc-header__active-heading">
                            {activeHeading && (
                                <a href={`#${activeHeading.slug}`}>
                                    {activeHeading.text}
                                </a>
                            )}
                        </div>
                    )}

                    <button
                        className="toc-header-button toc-header-button--toggle"
                        data-track-note="page_toggle_toc"
                        aria-label={`${
                            isOpen ? "Close" : "Open"
                        } table of contents`}
                        onClick={toggleIsOpen}
                    >
                        <FontAwesomeIcon icon={isOpen ? faTimes : faBars} />
                        <span
                            className={cx("toc-header-button__label", {
                                "toc-header-button__label--collapsed-sm":
                                    activeHeading,
                            })}
                        >
                            {isOpen ? "Close" : "Contents"}
                        </span>
                    </button>
                    {activeHeading && (
                        <a
                            className="toc-header-button"
                            onClick={close}
                            href="#"
                        >
                            <FontAwesomeIcon icon={faArrowUp} />
                        </a>
                    )}
                </div>

                {isOpen && (
                    <nav className="toc-nav">
                        <ul>
                            {headings
                                .filter((heading) =>
                                    hideSubheadings && heading.isSubheading
                                        ? false
                                        : true
                                )
                                .map((heading, i: number) => (
                                    <li
                                        key={i}
                                        className={
                                            (heading.isSubheading
                                                ? "subsection"
                                                : "section") +
                                            (activeHeading &&
                                            heading.slug === activeHeading.slug
                                                ? " active"
                                                : "")
                                        }
                                    >
                                        <a
                                            onClick={close}
                                            href={`#${heading.slug}`}
                                            data-track-note="toc_link"
                                        >
                                            {heading.text}
                                        </a>
                                    </li>
                                ))}
                        </ul>
                    </nav>
                )}
            </aside>
        </div>
    )
}

export const runTableOfContents = (tocData: TableOfContentsData) => {
    const tocWrapperEl = document.querySelector<HTMLElement>(
        `.${TOC_WRAPPER_CLASSNAME}`
    )
    if (!tocWrapperEl) return

    const sidebarRootEl = wrapInDiv(tocWrapperEl, ["sidebar-root"])
    ReactDOM.hydrate(<TableOfContents {...tocData} />, sidebarRootEl)
}
