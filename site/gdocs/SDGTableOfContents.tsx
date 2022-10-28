import React, { useState } from "react"
import { TocHeading } from "../../clientUtils/owidTypes.js"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

const VERTICAL_TAB_CHAR = "\u000b"

export default function SDGTableOfContents({ toc }: { toc: TocHeading[] }) {
    const [isOpen, setIsOpen] = useState(true)

    const toggleIsOpen = () => {
        setIsOpen(!isOpen)
    }

    const tocHeadingsWithSupertitle = toc.map((heading) => {
        const [beforeSeparator, afterSeparator] =
            heading.text.split(VERTICAL_TAB_CHAR)

        return {
            ...heading,
            supertitle: afterSeparator ? beforeSeparator : undefined,
            title: afterSeparator || beforeSeparator,
        }
    })

    return (
        <nav className="sdg-toc">
            <span onClick={toggleIsOpen} data-track-note="sdg-toc-toggle">
                Index
            </span>
            {isOpen && (
                <ul>
                    {tocHeadingsWithSupertitle.map(
                        (
                            { title, supertitle, isSubheading, slug },
                            i: number
                        ) => (
                            <li
                                key={i}
                                className={
                                    isSubheading ? "subsection" : "section"
                                }
                            >
                                <a
                                    href={`#${slug}`}
                                    data-track-note="sdg-toc-link"
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
            )}
        </nav>
    )
}
