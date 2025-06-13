import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import cx from "classnames"
import * as React from "react"
import { useState } from "react"

export const SearchTopicsRefinementList = ({
    topics,
    facets,
    addTopic,
}: {
    topics: Set<string>
    facets?: Record<string, number>
    addTopic: (topic: string) => void
}) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const entries = facets
        ? Object.entries(facets).filter(([facetName, matches]) => {
              // Only show topics that haven't already been selected that have matches
              return !topics.has(facetName) && !!matches
          })
        : []

    return (
        <div className="search-topics-refinement-list span-cols-12 col-start-2">
            <h3 className="data-catalog-ribbons__refinements-heading h5-black-caps">
                All areas of research
            </h3>
            {entries.length ? (
                <>
                    <button
                        aria-expanded={isExpanded}
                        aria-label={
                            isExpanded ? "Collapse topics" : "Expand topics"
                        }
                        className="search-topics-refinement-expand-button"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <h5 className="h5-black-caps">Filter by topic</h5>
                        <FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} />
                    </button>
                    <ul
                        className={cx("search-topics-refinement-list__list", {
                            "search-topics-refinement-list__list--is-expanded":
                                isExpanded,
                        })}
                    >
                        {entries.map(([facetName, count], i) => {
                            const facetNameLabel = facetName.replaceAll(
                                " and ",
                                " & "
                            )
                            const isLast = i === entries.length - 1
                            return (
                                <React.Fragment key={i}>
                                    <li className="search-topics-refinement-list__list-item">
                                        <button
                                            aria-label={`Filter by ${facetName}`}
                                            onClick={() => addTopic(facetName)}
                                        >
                                            <span className="body-3-bold">
                                                {facetNameLabel}
                                            </span>{" "}
                                            <span className="body-3-regular">
                                                ({commafyNumber(count)})
                                            </span>
                                        </button>
                                    </li>
                                    {!isLast ? (
                                        <li
                                            className="search-topics-refinement-list__separator"
                                            aria-hidden="true"
                                        >
                                            {/* including an empty space so that the list has spaces in it when copied to clipboard */}{" "}
                                        </li>
                                    ) : null}
                                </React.Fragment>
                            )
                        })}
                    </ul>
                </>
            ) : (
                <div
                    className={cx("search-topics-refinement-list__skeleton", {
                        "search-topics-refinement-list__skeleton--large":
                            topics.size,
                    })}
                />
            )}
        </div>
    )
}
