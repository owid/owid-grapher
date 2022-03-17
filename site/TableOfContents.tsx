import React from "react"
import { useState, useEffect, useRef } from "react"
import ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBars } from "@fortawesome/free-solid-svg-icons/faBars.js"
import { useTriggerWhenClickOutside } from "./hooks.js"
import { wrapInDiv } from "../clientUtils/Util.js"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes.js"
import { TocHeading } from "../clientUtils/owidTypes.js"

const TOC_WRAPPER_CLASSNAME = "toc-wrapper"

interface TableOfContentsData {
    headings: TocHeading[]
    pageTitle: string
    hideSubheadings?: boolean
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
}: TableOfContentsData) => {
    const [isToggled, setIsToggled] = useState(false)
    const [isSticky, setIsSticky] = useState(false)
    const [activeHeading, setActiveHeading] = useState("")
    const tocRef = useRef<HTMLElement>(null)
    const stickySentinelRef = useRef<HTMLDivElement>(null)

    const toggle = () => {
        setIsToggled(!isToggled)
    }

    useTriggerWhenClickOutside(tocRef, isToggled, setIsToggled)

    useEffect(() => {
        if ("IntersectionObserver" in window) {
            // Sets up an intersection observer to notify when the element with the class
            // `.sticky-sentinel` becomes visible/invisible at the top of the viewport.
            // Inspired by https://developers.google.com/web/updates/2017/09/sticky-headers
            const observer = new IntersectionObserver((records) => {
                for (const record of records) {
                    const targetInfo = record.boundingClientRect
                    // Started sticking
                    if (targetInfo.top < 0) {
                        setIsSticky(true)
                    }
                    // Stopped sticking
                    if (targetInfo.bottom > 0) {
                        setIsSticky(false)
                    }
                }
            })
            if (stickySentinelRef.current) {
                observer.observe(stickySentinelRef.current)
            }
        }
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
            if (hideSubheadings) {
                contentHeadings = document.querySelectorAll("h2")
            } else {
                contentHeadings = document.querySelectorAll("h2, h3")
            }
            contentHeadings.forEach((contentHeading) => {
                observer.observe(contentHeading)
            })
        }
    }, [])

    return (
        <div className={TOC_WRAPPER_CLASSNAME}>
            <aside
                className={`entry-sidebar${isToggled ? " toggled" : ""}${
                    isSticky ? " sticky" : ""
                }`}
                ref={tocRef}
            >
                <div className="sticky-sentinel" ref={stickySentinelRef} />
                <nav className="entry-toc">
                    <ul>
                        <li>
                            <a
                                onClick={() => {
                                    toggle()
                                    setActiveHeading("")
                                }}
                                href="#"
                                data-track-note="toc-header"
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
                                        onClick={toggle}
                                        href={`#${heading.slug}`}
                                        data-track-note="toc-link"
                                    >
                                        {heading.text}
                                    </a>
                                </li>
                            ))}
                    </ul>
                </nav>
                <div className="toggle-toc">
                    <button
                        data-track-note="page-toggle-toc"
                        aria-label={`${
                            isToggled ? "Close" : "Open"
                        } table of contents`}
                        onClick={toggle}
                    >
                        <FontAwesomeIcon icon={isToggled ? faTimes : faBars} />
                        <span className="label">
                            {isToggled ? "Close" : "Contents"}
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
