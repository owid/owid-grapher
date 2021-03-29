import * as React from "react"
import { useState, useEffect, useRef } from "react"
import * as ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { faListAlt } from "@fortawesome/free-solid-svg-icons/faListAlt"
import { SubNavId, TocHeading } from "../clientUtils/owidTypes"
import { SubnavItem, subnavs } from "./SiteSubnavigation"
import { Breadcrumb, getSubnavItem } from "./Breadcrumb/Breadcrumb"

const TOC_CLASS_NAME = "entry-sidebar"

interface TableOfContentsData {
    subnavId?: SubNavId
    subnavCurrentHref?: string
    headings?: TocHeading[]
    hideSubheadings?: boolean
    pageTitle?: string
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
    hideSubheadings,
    subnavId,
    subnavCurrentHref,
    pageTitle,
}: TableOfContentsData) => {
    const [isToggled, setIsToggled] = useState(false)
    const [isSticky, setIsSticky] = useState(false)
    const [activeHeading, setActiveHeading] = useState("")
    // const tocRef = useRef<HTMLDivElement>(null)
    const stickySentinelRef = useRef<HTMLDivElement>(null)

    const toggle = () => {
        // TODO fix edge case:
        // - open nav
        // - open search
        // - close search (removes overflowY hidden, thus re-enabling the scroll)
        if (!isToggled) document.body.style.overflowY = "hidden"
        else document.body.style.overflowY = ""
        setIsToggled(!isToggled)
    }

    // useTriggerWhenClickOutside(tocRef, setIsToggled)

    // useEffect(() => {
    //     if ("IntersectionObserver" in window) {
    //         // Sets up an intersection observer to notify when the element with the class
    //         // `.sticky-sentinel` becomes visible/invisible at the top of the viewport.
    //         // Inspired by https://developers.google.com/web/updates/2017/09/sticky-headers
    //         const observer = new IntersectionObserver((records) => {
    //             for (const record of records) {
    //                 const targetInfo = record.boundingClientRect
    //                 // Started sticking
    //                 if (targetInfo.top < 0) {
    //                     setIsSticky(true)
    //                 }
    //                 // Stopped sticking
    //                 if (targetInfo.bottom > 0) {
    //                     setIsSticky(false)
    //                 }
    //             }
    //         })
    //         if (stickySentinelRef.current) {
    //             observer.observe(stickySentinelRef.current)
    //         }
    //     }
    // }, [])

    useEffect(() => {
        if ("IntersectionObserver" in window && headings) {
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

    const renderTableOfContents = (headings: TocHeading[] | undefined) => {
        const subnavLabel = subnavId
            ? getSubnavItem(subnavCurrentHref, subnavs[subnavId])?.label
            : undefined
        const title = pageTitle ?? subnavLabel ?? "Contents"

        return (
            headings && (
                <ul className="toc">
                    {title && (
                        <li>
                            <a href="#">{title}</a>
                        </li>
                    )}
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
                                <a href={`#${heading.slug}`}>{heading.text}</a>
                            </li>
                        ))}
                </ul>
            )
        )
    }

    const renderSubnavigation = (
        subnavigationItems: SubnavItem[],
        subnavigationLevel = 0,
        parentId?: string
    ) => {
        return subnavigationItems
            .filter((item) => item.parentId === parentId)
            .map(({ href, label, id, highlight }, idx) => {
                const classes: string[] = [
                    subnavigationLevel === 0 && idx === 0
                        ? ""
                        : `${"sub".repeat(subnavigationLevel)}section`,
                ]
                const dataTrackNote = [subnavId, "subnav", id].join("-")
                if (href === subnavCurrentHref) classes.push("current")
                if (highlight) classes.push("highlight")

                return (
                    <React.Fragment key={href}>
                        <li className={classes.join(" ")}>
                            <a href={href} data-track-note={dataTrackNote}>
                                {label}
                            </a>
                        </li>
                        {renderSubnavigation(
                            subnavigationItems,
                            subnavigationLevel + 1,
                            id
                        )}
                    </React.Fragment>
                )
            })
    }

    return (headings && headings.length) || (subnavId && subnavCurrentHref) ? (
        <aside
            className={`${TOC_CLASS_NAME}${isToggled ? " toggled" : ""}${
                isSticky ? " sticky" : ""
            }`}
        >
            {/* <div className="sticky-sentinel" ref={stickySentinelRef} /> */}
            <div className="toggle-toc">
                <button
                    data-track-note="page-toggle-toc"
                    aria-label={`${
                        isToggled ? "Close" : "Open"
                    } table of contents`}
                    onClick={toggle}
                >
                    {isToggled ? (
                        <>
                            <FontAwesomeIcon icon={faTimes} />
                            Close
                        </>
                    ) : (
                        <>
                            <FontAwesomeIcon icon={faListAlt} />
                            <Breadcrumb
                                subnavId={subnavId}
                                subnavCurrentHref={subnavCurrentHref}
                            />
                        </>
                    )}
                </button>
            </div>
            {isToggled ? (
                <nav className="entry-toc">
                    <div className="container" onClick={toggle}>
                        {subnavId && subnavs[subnavId] && (
                            <ul className="subnavigation">
                                {renderSubnavigation(subnavs[subnavId])}
                            </ul>
                        )}
                        {renderTableOfContents(headings)}
                    </div>
                </nav>
            ) : null}
        </aside>
    ) : null
}

// export const runTableOfContents = (tocData: TableOfContentsData) => {
//     const tocEl = document.querySelector<HTMLElement>(`.${TOC_CLASS_NAME}`)
//     if (tocEl) {
//         const tocWrapper = tocEl.parentElement
//         ReactDOM.hydrate(<TableOfContents {...tocData} />, tocWrapper)
//     }
// }
