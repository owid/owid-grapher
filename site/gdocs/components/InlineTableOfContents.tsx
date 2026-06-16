import { TocHeadingWithTitleSupertitle } from "@ourworldindata/utils"
import { faArrowDown, faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"

export default function InlineTableOfContents({
    toc,
    className = "",
    title,
}: {
    toc: TocHeadingWithTitleSupertitle[]
    className?: string
    title: string
}) {
    return (
        <nav className={cx(className, "inline-toc")}>
            <details className="inline-toc__details-wrapper span-cols-6 span-md-cols-8 span-sm-cols-10">
                <summary
                    className="inline-toc__toggle"
                    aria-label="Toggle table of contents"
                    data-track-note="toc_toggle"
                >
                    <span>{title}</span>
                    <span className="inline-toc__toggle-icon">
                        <FontAwesomeIcon
                            className="icon-closed"
                            icon={faPlus}
                        />
                        <FontAwesomeIcon className="icon-open" icon={faMinus} />
                    </span>
                </summary>
                <div className="inline-toc__content">
                    <ul>
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
        </nav>
    )
}
