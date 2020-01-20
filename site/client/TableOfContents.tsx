import * as React from "react"
import { useState, useEffect, useRef } from "react"
import * as ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBookOpen } from "@fortawesome/free-solid-svg-icons/faBookOpen"
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons/faChevronLeft"

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
    const tocRef = useRef<HTMLElement>(null)

    const toggle = () => {
        setIsToggled(!isToggled)
    }

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (tocRef.current && !tocRef.current.contains(e.target as Node)) {
                setIsToggled(false)
            }
        }
        document.addEventListener("mousedown", handleClick)

        return () => {
            document.removeEventListener("mousedown", handleClick)
        }
    }, [])

    return (
        <aside
            ref={tocRef}
            className={`${TOC_CLASS_NAME}${isToggled ? " toggled" : ""}`}
        >
            <nav className="entry-toc">
                <button
                    aria-label={`${
                        isToggled ? "Close" : "Open"
                    } table of contents`}
                    className="toggle-toc"
                    onClick={toggle}
                >
                    <FontAwesomeIcon
                        icon={isToggled ? faChevronLeft : faBookOpen}
                        className="toggle-toc"
                    />
                </button>
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
