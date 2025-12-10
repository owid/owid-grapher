import { TocHeadingWithTitleSupertitle } from "@ourworldindata/utils"
import { faArrowDown, faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"

export default function TableOfContents({
    toc,
    className = "",
    title,
}: {
    toc: TocHeadingWithTitleSupertitle[]
    className?: string
    title: string
}) {
    return (
        <div className={cx(className, "toc")}>
            <details className="toc-details-wrapper span-cols-6 span-md-cols-8 span-sm-cols-10">
                <summary
                    className="toc-toggle"
                    aria-label="Toggle table of contents"
                    data-track-note="toc_toggle"
                >
                    <span>{title}</span>
                    <span className="toc-toggle-icon">
                        <FontAwesomeIcon
                            className="icon-closed"
                            icon={faPlus}
                        />
                        <FontAwesomeIcon className="icon-open" icon={faMinus} />
                    </span>
                </summary>
                <div className="toc-content">
                    <ul
                        id="toc-menu"
                        role="menu"
                        aria-labelledby="toc-menu-button"
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
                                >
                                    <a
                                        href={`#${slug}`}
                                        data-track-note="toc_link"
                                        role="menuitem"
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
                </div>
            </details>
        </div>
    )
}
