import * as React from "react"
import { useState } from "react"
import * as ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBookOpen } from "@fortawesome/free-solid-svg-icons/faBookOpen"

const TOC_CLASS_NAME = "entry-sidebar"

interface TableOfContentsData {
    headings: { isSubheading: boolean; slug: string; text: string }[]
    isFootnotes: boolean
    isEntry: boolean
    pageTitle: string
}

export const TableOfContents = ({
    headings,
    isFootnotes,
    isEntry,
    pageTitle
}: TableOfContentsData) => {
    const [isToggled, setIsToggled] = useState(false)

    const toggle = () => {
        setIsToggled(!isToggled)
    }

    return (
        <aside className={`${TOC_CLASS_NAME}${isToggled ? " toggled" : ""}`}>
            <nav className="entry-toc">
                <div className="toggle-toc-wrapper">
                    <div className="toggle-toc" onClick={toggle}>
                        <FontAwesomeIcon
                            icon={faBookOpen}
                            className="toggle-toc"
                        />
                    </div>
                </div>
                <ul>
                    <li>
                        <a onClick={toggle} href="#">
                            {pageTitle}
                        </a>
                    </li>
                    {headings.map((heading, i: number) => (
                        <li
                            key={i}
                            className={
                                heading.isSubheading
                                    ? "subsection"
                                    : "section" +
                                      (!headings[i + 1] ||
                                      !headings[i + 1].isSubheading
                                          ? " nosubs"
                                          : "")
                            }
                        >
                            <a onClick={toggle} href={`#${heading.slug}`}>
                                {heading.text}
                            </a>
                        </li>
                    ))}
                    {isFootnotes ? (
                        <li key="references" className="section nosubs">
                            <a onClick={toggle} href={`#references`}>
                                References
                            </a>
                        </li>
                    ) : (
                        undefined
                    )}
                    {isEntry && (
                        <li key="citation" className="section nosubs">
                            <a href={`#citation`}>Citation</a>
                        </li>
                    )}
                </ul>
            </nav>
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
