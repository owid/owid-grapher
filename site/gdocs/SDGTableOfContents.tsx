import React, { useState } from "react"
import { TocHeadingWithTitleSupertitle } from "@ourworldindata/utils"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import classNames from "classnames"
import AnimateHeight from "react-animate-height"

// See ARIA roles: https://w3c.github.io/aria-practices/examples/menu-button/menu-button-links.html

export default function SDGTableOfContents({
    toc,
}: {
    toc: TocHeadingWithTitleSupertitle[]
}) {
    const [height, setHeight] = useState<"auto" | 0>(0)
    const [isOpen, setIsOpen] = useState(false)

    const toggleIsOpen = () => {
        setHeight(height === 0 ? "auto" : 0)
    }

    return (
        <nav
            className={classNames("sdg-toc", { open: isOpen })}
            role="button"
            onClick={toggleIsOpen}
            aria-haspopup="true"
            aria-controls="sdg-toc-menu"
            data-track-note="sdg-toc-toggle"
        >
            <button
                id="sdg-toc-menu-button"
                className="sdg-toc-toggle"
                onClick={toggleIsOpen}
                aria-haspopup="true"
                aria-controls="sdg-toc-menu"
                data-track-note="sdg-toc-toggle"
            >
                <span>Index</span>
                <span>
                    <FontAwesomeIcon icon={isOpen ? faMinus : faPlus} />
                </span>
            </button>
            <AnimateHeight
                className="sdg-toc-content"
                height={height}
                onHeightAnimationStart={(newHeight) => {
                    if (newHeight != 0) setIsOpen(true)
                }}
                onHeightAnimationEnd={(newHeight) => {
                    if (newHeight === 0) setIsOpen(false)
                }}
                animateOpacity
            >
                <ul
                    id="sdg-toc-menu"
                    role="menu"
                    aria-labelledby="sdg-toc-menu-button"
                >
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
                                    data-track-note="sdg-toc-link"
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
