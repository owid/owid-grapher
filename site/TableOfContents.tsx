import React, { useState, useEffect, useRef } from "react"
import ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons"
import { useTriggerWhenClickOutside } from "./hooks.js"
import { wrapInDiv, TocHeading } from "@ourworldindata/utils"
import classNames from "classnames"

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
    const [activeHeading, setActiveHeading] = useState("")
    const { primary, secondary } = headingLevels
    const tocRef = useRef<HTMLElement>(null)

    const toggleIsOpen = () => {
        setIsOpen(!isOpen)
    }
    // The Gdocs sidebar can't rely on the same CSS logic that old-style entries use, so we need to
    // explicitly trigger these toggles based on screen width
    const toggleIsOpenOnMobile = () => {
        if (window.innerWidth < 1536) {
            toggleIsOpen()
        }
    }

    useTriggerWhenClickOutside(tocRef, isOpen, () => setIsOpen(false))

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
                        setActiveHeading(currentHeadingRecord.target.id)
                    } else {
                        // Target headings going up
                        nextHeadingRecord = records.find(
                            (record) =>
                                isRecordTopViewport(record) &&
                                record.intersectionRatio === 1
                        )
                        if (nextHeadingRecord) {
                            setActiveHeading(
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
                            setActiveHeading(
                                currentHeadingRecord?.target.id || ""
                            )
                        }
                    }
                    init = false
                },
                {
                    rootMargin: "-10px", // 10px offset to trigger intersection when landing exactly at the border when clicking an anchor
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
    }, [headings, hideSubheadings, primary, secondary])

    return (
        <div className={TOC_WRAPPER_CLASSNAME}>
            <div
                className={classNames({
                    "entry-sidebar__overlay": isOpen,
                })}
            />
            <aside
                className={classNames("entry-sidebar", {
                    "entry-sidebar--is-open": isOpen,
                })}
                ref={tocRef}
            >
                <nav className="entry-toc">
                    <ul>
                        <li>
                            <a
                                onClick={() => {
                                    toggleIsOpenOnMobile()
                                    setActiveHeading("")
                                }}
                                href="#"
                                data-track-note="toc_header"
                            >
                                {pageTitle}
                            </a>
                        </li>
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
                                        (heading.slug === activeHeading
                                            ? " active"
                                            : "")
                                    }
                                >
                                    <a
                                        onClick={toggleIsOpenOnMobile}
                                        href={`#${heading.slug}`}
                                        data-track-note="toc_link"
                                    >
                                        {heading.text}
                                    </a>
                                </li>
                            ))}
                    </ul>
                </nav>
                <div className="toggle-toc">
                    <button
                        data-track-note="page_toggle_toc"
                        aria-label={`${
                            isOpen ? "Close" : "Open"
                        } table of contents`}
                        onClick={toggleIsOpen}
                    >
                        <FontAwesomeIcon icon={isOpen ? faTimes : faBars} />
                        <span className="label">
                            {isOpen ? "Close" : "Contents"}
                        </span>
                    </button>
                </div>
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
