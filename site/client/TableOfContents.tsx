import * as React from "react"
import { useState, useEffect, useRef } from "react"
import * as ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faListAlt } from "@fortawesome/free-solid-svg-icons/faListAlt"
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons/faChevronLeft"
import { useTriggerWhenClickOutside } from "./hooks"

const TOC_CLASS_NAME = "entry-sidebar"

interface TableOfContentsData {
    headings: { isSubheading: boolean; slug: string; text: string }[]
    pageTitle: string
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
        heading => heading.slug === nextHeadingRecord?.target.id
    )?.previous
}

export const TableOfContents = ({
    headings,
    pageTitle
}: TableOfContentsData) => {
    const [isToggled, setIsToggled] = useState(false)
    const [isSticky, setIsSticky] = useState(false)
    const [activeHeading, setActiveHeading] = useState("")
    const tocRef = useRef<HTMLElement>(null)
    const stickySentinelRef = useRef<HTMLDivElement>(null)

    const toggle = () => {
        setIsToggled(!isToggled)
    }

    useTriggerWhenClickOutside(tocRef, setIsToggled)

    useEffect(() => {
        // Sets up an intersection observer to notify when the element with the class
        // `.sticky-sentinel` becomes visible/invisible at the top of the viewport.
        // Inspired by https://developers.google.com/web/updates/2017/09/sticky-headers
        const observer = new IntersectionObserver((records, observer) => {
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
    }, [])

    useEffect(() => {
        const previousHeadings = headings.map((heading, i) => ({
            slug: heading.slug,
            previous: i > 0 ? headings[i - 1].slug : null
        }))

        let currentHeadingRecord: IntersectionObserverEntry | undefined
        let init = true

        const observer = new IntersectionObserver(
            records => {
                let nextHeadingRecord: IntersectionObserverEntry | undefined

                // Target headings going down
                currentHeadingRecord = records.find(
                    record =>
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
                        record =>
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
                            .find(record => record.boundingClientRect.top < 0)
                        setActiveHeading(currentHeadingRecord?.target.id || "")
                    }
                }
                init = false
            },
            {
                rootMargin: "-10px", // 10px offset to trigger intersection when landing exactly at the border when clicking an anchor
                threshold: new Array(11).fill(0).map((v, i) => i / 10)
            }
        )

        const contentHeadings = document.querySelectorAll("h2, h3")
        contentHeadings.forEach(contentHeading => {
            observer.observe(contentHeading)
        })
    }, [])

    return (
        <aside
            ref={tocRef}
            className={`${TOC_CLASS_NAME}${isToggled ? " toggled" : ""}${
                isSticky ? " sticky" : ""
            }`}
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
                        >
                            {pageTitle}
                        </a>
                    </li>
                    {headings.map((heading, i: number) => (
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
                            <a onClick={toggle} href={`#${heading.slug}`}>
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="toggle-toc">
                <button
                    aria-label={`${
                        isToggled ? "Close" : "Open"
                    } table of contents`}
                    onClick={toggle}
                >
                    <FontAwesomeIcon
                        icon={isToggled ? faChevronLeft : faListAlt}
                    />
                </button>
            </div>
        </aside>
    )
}

export const runTableOfContents = (tocData: TableOfContentsData) => {
    const tocEl = document.querySelector<HTMLElement>(`.${TOC_CLASS_NAME}`)
    if (tocEl) {
        const tocWrapper = tocEl.parentElement
        ReactDOM.hydrate(<TableOfContents {...tocData} />, tocWrapper)
    }
}
