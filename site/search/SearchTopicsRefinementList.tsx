import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"
import * as React from "react"
import { useState } from "react"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { getSelectableTopics } from "./searchUtils.js"
import { SearchTopicType } from "./searchTypes.js"

export const SearchTopicsRefinementList = ({
    topicType,
}: {
    topicType: SearchTopicType | null
}) => {
    const {
        actions: { setTopic },
        topicTagGraph,
        state: { query },
    } = useSearchContext()
    const selectedTopic = useSelectedTopic()
    const selectableTopics = [
        ...getSelectableTopics(topicTagGraph, selectedTopic),
    ]

    const [isExpanded, setIsExpanded] = useState(false)

    return selectableTopics.length > 0 && !query ? (
        <div className="search-topics-refinement-list">
            <h3 className="search-topics-refinement-list__heading h5-black-caps">
                Filter by{" "}
                {topicType === SearchTopicType.Area
                    ? "topic"
                    : "area of research"}
                :
            </h3>
            <button
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse topics" : "Expand topics"}
                className="search-topics-refinement-list__expand-button"
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
                    const topicLabel = topic.replaceAll(" and ", " & ")
                    const isLast = i === selectableTopics.length - 1
                    return (
                        <React.Fragment key={i}>
                            <li className="search-topics-refinement-list__list-item">
                                <button
                                    aria-label={`Filter by ${topic}`}
                                    onClick={() => setTopic(topic)}
                                >
                                    <span className="body-3-medium">
                                        {topicLabel}
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
