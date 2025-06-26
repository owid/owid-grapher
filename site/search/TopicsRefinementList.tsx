import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import cx from "classnames"
import * as React from "react"
import { useState } from "react"

export const TopicsRefinementList = ({
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
    if (!entries.length)
        return (
            <div className="data-catalog-refinement-list span-cols-12 col-start-2" />
        )

    return (
        <div className="data-catalog-refinement-list span-cols-12 col-start-2">
            <button
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse topics" : "Expand topics"}
                className="data-catalog-refinements-expand-button"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h5 className="h5-black-caps">Filter by topic</h5>
                <FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} />
            </button>
            <ul
                className={cx("data-catalog-refinement-list__list", {
                    "data-catalog-refinement-list__list--is-expanded":
                        isExpanded,
                })}
            >
                {entries.map(([facetName, count], i) => {
                    const facetNameLabel = facetName.replaceAll(" and ", " & ")
                    const isLast = i === entries.length - 1
                    return (
                        <React.Fragment key={i}>
                            <li className="data-catalog-refinement-list__list-item">
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
                                    className="data-catalog-refinement-list__separator"
                                    aria-hidden="true"
                                >
                                    {/* including an empty space so that the list has spaces in it when copied to clipboard */}{" "}
                                </li>
                            ) : null}
                        </React.Fragment>
                    )
                })}
            </ul>
        </div>
    )
}
