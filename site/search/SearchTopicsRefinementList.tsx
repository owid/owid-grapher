import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SearchClient } from "algoliasearch"
import { TagGraphRoot } from "@ourworldindata/types"
import cx from "classnames"
import * as React from "react"
import { useState } from "react"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { getSelectableTopics } from "./searchUtils.js"

export const SearchTopicsRefinementList = ({
    topicTagGraph,
}: {
    searchClient: SearchClient
    topicTagGraph: TagGraphRoot
}) => {
    const {
        actions: { setTopic },
    } = useSearchContext()
    const selectedTopic = useSelectedTopic()
    const selectableTopics = getSelectableTopics(topicTagGraph, selectedTopic)

    const [isExpanded, setIsExpanded] = useState(false)

    return selectableTopics.length > 0 ? (
        <div className="search-topics-refinement-list span-cols-9 col-start-2">
            <h3 className="data-catalog-ribbons__refinements-heading h5-black-caps">
                All areas of research
            </h3>
            <button
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse topics" : "Expand topics"}
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
                {selectableTopics.map((topic, i) => {
                    const isLast = i === selectableTopics.length - 1
                    return (
                        <React.Fragment key={i}>
                            <li className="search-topics-refinement-list__list-item">
                                <button
                                    aria-label={`Filter by ${topic}`}
                                    onClick={() => setTopic(topic)}
                                >
                                    <span className="body-3-bold">
                                        {topic}
                                    </span>{" "}
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
        </div>
    ) : null
}
