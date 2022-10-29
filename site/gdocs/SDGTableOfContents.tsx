import React, { useState } from "react"
import { TocHeading } from "../../clientUtils/owidTypes.js"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import classNames from "classnames"
import AnimateHeight from "react-animate-height"

const VERTICAL_TAB_CHAR = "\u000b"

export default function SDGTableOfContents({ toc }: { toc: TocHeading[] }) {
    const [height, setHeight] = useState<"auto" | 0>(0)
    const [isOpen, setIsOpen] = useState(false)

    const toggleIsOpen = () => {
        setHeight(height === 0 ? "auto" : 0)
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
        <nav className={classNames("sdg-toc", { open: isOpen })}>
            <div
                onClick={toggleIsOpen}
                className="sdg-toc-toggle"
                data-track-note="sdg-toc-toggle"
            >
                <div>Index</div>
                <div>
                    <FontAwesomeIcon icon={isOpen ? faMinus : faPlus} />
                </div>
            </div>
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
            </AnimateHeight>
        </nav>
    )
}
