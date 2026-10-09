import { useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronDown } from "@fortawesome/free-solid-svg-icons"
import GrapherImage from "./GrapherImage.js"
import { DataPerspective } from "./dataPerspectivesFixtures.js"
import { thumbQueryString } from "./dataPerspectivesVariant.js"

/**
 * Swipeless mobile variant (`?dpLayout=accordion`): no chart at the top of the
 * page at all. Instead the page *is* a vertical list of data perspectives,
 * each of which expands into the full interactive grapher for that view.
 *
 * Everything starts collapsed. Only one row is expanded at a time, so at most
 * one grapher is ever mounted — collapsed rows cost a thumbnail each.
 */
export function DataPerspectivesAccordion({
    slug,
    perspectives,
    renderGrapher,
    onExpand,
}: {
    slug: string
    perspectives: DataPerspective[]
    /** Renders a live grapher for one perspective's query params. */
    renderGrapher: (queryParams: string) => React.ReactNode
    onExpand?: (index: number) => void
}) {
    // Collapsed by default: the list itself is the first thing you see.
    const [expanded, setExpanded] = useState<number | null>(null)

    const toggle = (index: number) => {
        setExpanded((current) => {
            const next = current === index ? null : index
            if (next !== null) onExpand?.(next)
            return next
        })
    }

    return (
        <ol className="data-perspectives-accordion">
            {perspectives.map((p, index) => {
                const isExpanded = expanded === index
                return (
                    <li
                        className={cx("data-perspectives-accordion__item", {
                            "data-perspectives-accordion__item--expanded":
                                isExpanded,
                        })}
                        key={p.queryParams}
                    >
                        <button
                            type="button"
                            className="data-perspectives-accordion__header"
                            aria-expanded={isExpanded}
                            onClick={() => toggle(index)}
                        >
                            {!isExpanded && (
                                <span className="data-perspectives-accordion__thumb">
                                    <GrapherImage
                                        slug={slug}
                                        queryString={thumbQueryString(
                                            p.queryParams
                                        )}
                                        alt={p.title}
                                        noFormatting
                                    />
                                </span>
                            )}
                            <span className="data-perspectives-accordion__heading">
                                <span className="data-perspectives-accordion__title">
                                    {p.title}
                                </span>
                            </span>
                            <FontAwesomeIcon
                                icon={faChevronDown}
                                className="data-perspectives-accordion__chevron"
                            />
                        </button>

                        {isExpanded && (
                            <div className="data-perspectives-accordion__body">
                                {renderGrapher(p.queryParams)}
                            </div>
                        )}
                    </li>
                )
            })}
        </ol>
    )
}
