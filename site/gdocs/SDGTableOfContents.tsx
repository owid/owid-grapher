import React, { useState } from "react"
import { TocHeading } from "../../clientUtils/owidTypes.js"

export default function SDGTableOfContents({ toc }: { toc: TocHeading[] }) {
    const [isOpen, setIsOpen] = useState(false)

    const toggleIsOpen = () => {
        setIsOpen(!isOpen)
    }

    return (
        <nav className="entry-toc">
            <span onClick={toggleIsOpen} data-track-note="sdg-toc-toggle">
                Index
            </span>
            {isOpen && (
                <ul>
                    {toc.map((heading, i: number) => (
                        <li
                            key={i}
                            className={
                                heading.isSubheading ? "subsection" : "section"
                            }
                        >
                            <a
                                href={`#${heading.slug}`}
                                data-track-note="sdg-toc-link"
                            >
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </nav>
    )
}
