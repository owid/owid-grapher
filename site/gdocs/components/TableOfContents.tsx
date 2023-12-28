import React, { useState } from "react"
import { TocHeadingWithTitleSupertitle } from "@ourworldindata/utils"
import { faArrowDown, faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import cx from "classnames"
import AnimateHeight from "react-animate-height"

// See ARIA roles: https://w3c.github.io/aria-practices/examples/menu-button/menu-button-links.html

export default function TableOfContents({
    toc,
    className = "",
    title,
}: {
    toc: TocHeadingWithTitleSupertitle[]
    className?: string
    title: string
}) {
    const [height, setHeight] = useState<"auto" | 0>(0)
    const [isOpen, setIsOpen] = useState(false)

    const toggleIsOpen = () => {
        setHeight(height === 0 ? "auto" : 0)
    }

    return (
        <nav
            className={cx(className, "toc", { open: isOpen })}
            role="button"
            onClick={toggleIsOpen}
            aria-haspopup="true"
            aria-controls="toc-menu"
            data-track-note="toc_toggle"
        >
            <button
                id="toc-menu-button"
                className="toc-toggle span-cols-6 span-md-cols-8 span-sm-cols-10"
                onClick={toggleIsOpen}
                aria-haspopup="true"
                aria-controls="toc-menu"
                data-track-note="toc_toggle"
            >
                <span>{title}</span>
                <span>
                    <FontAwesomeIcon icon={isOpen ? faMinus : faPlus} />
                </span>
            </button>
            <AnimateHeight
                className="toc-content span-cols-6 span-md-cols-8 span-sm-cols-10"
                height={height}
                onHeightAnimationStart={(newHeight) => {
                    if (newHeight !== 0) setIsOpen(true)
                }}
                onHeightAnimationEnd={(newHeight) => {
                    if (newHeight === 0) setIsOpen(false)
                }}
                animateOpacity
            >
                <ul id="toc-menu" role="menu" aria-labelledby="toc-menu-button">
                    {toc.map(
                        (
                            { title, supertitle, isSubheading, slug },
                            i: number
                        ) => (
                            <li
                                key={i}
                                className={
                                    isSubheading ? "subsection" : "section"
                                }
                                role="none"
                            >
                                <a
                                    href={`#${slug}`}
                                    data-track-note="toc_link"
                                    role="menuitem"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {supertitle ? (
                                        <span className="supertitle">
                                            {supertitle}
                                        </span>
                                    ) : null}
                                    {title}
                                </a>
                                {!isSubheading && (
                                    <FontAwesomeIcon icon={faArrowDown} />
                                )}
                            </li>
                        )
                    )}
                </ul>
            </AnimateHeight>
        </nav>
    )
}
