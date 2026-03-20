import { useCallback, useMemo, useState } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCaretDown,
    faCheck,
    faFilter,
} from "@fortawesome/free-solid-svg-icons"
import {
    ALL_FILTER_OPTIONS,
    LatestFilter,
    filtersAreEqual,
    encodeFilter,
} from "./latestFilters.js"

export const LatestTopicFacets = ({
    topics,
    selectedTopics,
    onTopicsChange,
    selectedFilter,
    onFilterChange,
    disabledFilters,
    disabledTopics,
    allTopicsDisabled,
    tagFacetCounts,
}: {
    topics: string[]
    selectedTopics: string[]
    onTopicsChange: (topics: string[]) => void
    selectedFilter: LatestFilter | null
    onFilterChange: (filter: LatestFilter | null) => void
    disabledFilters: Set<string>
    disabledTopics: Set<string>
    allTopicsDisabled: boolean
    tagFacetCounts: Record<string, number>
}) => {
    const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false)

    const topicLabel =
        selectedTopics.length === 0
            ? "Filter by area"
            : selectedTopics.length === 1
              ? selectedTopics[0]
              : `${selectedTopics.length} areas selected`

    const handleTopicToggle = useCallback(
        (topic: string) => {
            const isSelected = selectedTopics.includes(topic)
            if (isSelected) {
                onTopicsChange(selectedTopics.filter((t) => t !== topic))
            } else {
                onTopicsChange([...selectedTopics, topic])
            }
        },
        [selectedTopics, onTopicsChange]
    )

    const sortedTopics = useMemo(
        () => [...topics].sort((a, b) => a.localeCompare(b)),
        [topics]
    )

    return (
        <div className="latest-search__filters-wrapper">
            <p className="latest-search__filters-label">Filter by:</p>
            <div className="latest-search__filters">
                <div className="latest-search__type-filters">
                    {ALL_FILTER_OPTIONS.map((option) => {
                        const isActive = filtersAreEqual(
                            selectedFilter,
                            option.filter
                        )
                        const isDisabled = disabledFilters.has(
                            encodeFilter(option.filter)
                        )
                        return (
                            <button
                                key={encodeFilter(option.filter)}
                                className={cx("latest-search__type-button", {
                                    "latest-search__type-button--active":
                                        isActive,
                                    "latest-search__type-button--disabled":
                                        isDisabled,
                                })}
                                onClick={() =>
                                    onFilterChange(
                                        isActive ? null : option.filter
                                    )
                                }
                                disabled={isDisabled}
                            >
                                {option.label}
                            </button>
                        )
                    })}
                </div>
                <div className="latest-search__topic-dropdown">
                    <button
                        className={cx("latest-search__topic-trigger", {
                            "latest-search__topic-trigger--active":
                                selectedTopics.length > 0,
                            "latest-search__topic-trigger--disabled":
                                allTopicsDisabled,
                        })}
                        onClick={() =>
                            setIsTopicDropdownOpen(!isTopicDropdownOpen)
                        }
                        disabled={allTopicsDisabled}
                        aria-expanded={isTopicDropdownOpen}
                        aria-haspopup="listbox"
                    >
                        <FontAwesomeIcon
                            icon={faFilter}
                            className="latest-search__topic-trigger-icon"
                        />
                        <span className="latest-search__topic-trigger-label">
                            {topicLabel}
                        </span>
                        <FontAwesomeIcon
                            icon={faCaretDown}
                            className={cx(
                                "latest-search__topic-trigger-chevron",
                                {
                                    "latest-search__topic-trigger-chevron--open":
                                        isTopicDropdownOpen,
                                }
                            )}
                        />
                    </button>
                    {isTopicDropdownOpen && (
                        <>
                            <div
                                className="latest-search__topic-dropdown-backdrop"
                                onClick={() => setIsTopicDropdownOpen(false)}
                            />
                            <ul
                                className="latest-search__topic-dropdown-menu"
                                role="listbox"
                                aria-multiselectable="true"
                            >
                                {sortedTopics.map((topic) => {
                                    const isSelected =
                                        selectedTopics.includes(topic)
                                    const isDisabled = disabledTopics.has(topic)
                                    const count = tagFacetCounts[topic] ?? 0
                                    return (
                                        <li
                                            key={topic}
                                            className={cx(
                                                "latest-search__topic-dropdown-item",
                                                {
                                                    "latest-search__topic-dropdown-item--active":
                                                        isSelected,
                                                    "latest-search__topic-dropdown-item--disabled":
                                                        isDisabled,
                                                }
                                            )}
                                            role="option"
                                            aria-selected={isSelected}
                                            aria-disabled={isDisabled}
                                            onClick={
                                                isDisabled
                                                    ? undefined
                                                    : () =>
                                                          handleTopicToggle(
                                                              topic
                                                          )
                                            }
                                        >
                                            <span
                                                className={cx(
                                                    "latest-search__topic-checkbox",
                                                    {
                                                        "latest-search__topic-checkbox--checked":
                                                            isSelected,
                                                    }
                                                )}
                                            >
                                                {isSelected && (
                                                    <FontAwesomeIcon
                                                        icon={faCheck}
                                                        className="latest-search__topic-checkbox-icon"
                                                    />
                                                )}
                                            </span>
                                            <span className="latest-search__topic-dropdown-label">
                                                {topic}
                                            </span>
                                            <span className="latest-search__topic-dropdown-count">
                                                {count}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </>
                    )}
                </div>
            </div>
            <hr className="latest-search__filters-divider" />
        </div>
    )
}
