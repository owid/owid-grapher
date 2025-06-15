import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { TagGraphRoot } from "@ourworldindata/types"
import cx from "classnames"
import * as React from "react"
import { useState } from "react"
import { useSearchContext } from "./SearchContext.js"
import { useSearchFacets, useSelectedTopics } from "./searchHooks.js"

export const SearchTopicsRefinementList = ({
    searchClient,
    tagGraph,
    shouldShowRibbons,
}: {
    searchClient: SearchClient
    tagGraph: TagGraphRoot
    shouldShowRibbons: boolean
}) => {
    const {
        state,
        actions: { setTopic },
    } = useSearchContext()
    const selectedTopics = useSelectedTopics()

    const [isExpanded, setIsExpanded] = useState(false)

    const facets = useSearchFacets(
        searchClient,
        state,
        tagGraph,
        shouldShowRibbons
    )

    const entries = facets
        ? Object.entries(facets).filter(([facetName, matches]) => {
              // Only show topics that haven't already been selected that have matches
              return !selectedTopics.has(facetName) && !!matches
          })
        : []

    return (
        <div className="search-topics-refinement-list span-cols-9 col-start-2">
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
                                            onClick={() => setTopic(facetName)}
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
                            selectedTopics.size,
                    })}
                />
            )}
        </div>
    )
}
