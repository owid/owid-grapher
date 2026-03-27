import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCaretDown,
    faCaretLeft,
    faCaretRight,
    faFilter,
} from "@fortawesome/free-solid-svg-icons"
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu"
import {
    ALL_FILTER_OPTIONS,
    LatestFilter,
    filtersAreEqual,
    encodeFilter,
} from "./latestFilters.js"

/**
 * Wrapper component that accepts the `itemId` prop required by
 * react-horizontal-scrolling-menu while rendering a native button.
 */
const TopicPill = ({
    itemId: _itemId,
    ...props
}: {
    itemId: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    return <button {...props} />
}

const LeftArrow = () => {
    const { useLeftArrowVisible, scrollPrev } = useContext(VisibilityContext)
    const isFirstVisible = useLeftArrowVisible()

    // Hide arrow when first item is visible (we're at the start)
    if (isFirstVisible) return null

    return (
        <button
            className="latest-search__scroll-arrow latest-search__scroll-arrow--left"
            onClick={() => scrollPrev()}
        >
            <FontAwesomeIcon icon={faCaretLeft} />
        </button>
    )
}

const RightArrow = () => {
    const { useRightArrowVisible, scrollNext } = useContext(VisibilityContext)
    const isLastVisible = useRightArrowVisible()

    // Hide arrow when last item is visible (we're at the end)
    if (isLastVisible) return null

    return (
        <button
            className="latest-search__scroll-arrow latest-search__scroll-arrow--right"
            onClick={() => scrollNext()}
        >
            <FontAwesomeIcon icon={faCaretRight} />
        </button>
    )
}

export const LatestTopicFacets = ({
    topics,
    selectedTopics,
    onTopicsChange,
    selectedFilter,
    onFilterChange,
    disabledFilters,
    disabledTopics,
    allTopicsDisabled: _allTopicsDisabled,
    tagFacetCounts: _tagFacetCounts,
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
    const [isContentTypeDropdownOpen, setIsContentTypeDropdownOpen] =
        useState(false)

    type ScrollApiType = React.ContextType<typeof VisibilityContext>
    const apiRef = useRef({} as ScrollApiType)

    const handleTopicToggle = useCallback(
        (topic: string) => {
            const isSelected = selectedTopics.includes(topic)
            if (isSelected) {
                onTopicsChange([])
            } else {
                onTopicsChange([topic])
            }
            const item = apiRef.current.getItemById?.(topic)
            if (item) {
                apiRef.current.scrollToItem(item, "smooth", "center")
            }
        },
        [selectedTopics, onTopicsChange]
    )

    // Scroll the selected topic into view on initial load
    useEffect(() => {
        const topic = selectedTopics[0]
        if (!topic) return
        // Delay to allow ScrollMenu to register items
        const timer = requestAnimationFrame(() => {
            const item = apiRef.current.getItemById?.(topic)
            if (item) {
                apiRef.current.scrollToItem(item, "smooth", "center")
            }
        })
        return () => cancelAnimationFrame(timer)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const contentTypeLabel = useMemo(() => {
        if (!selectedFilter) return "Content types"
        const match = ALL_FILTER_OPTIONS.find((opt) =>
            filtersAreEqual(opt.filter, selectedFilter)
        )
        return match?.label ?? "Content types"
    }, [selectedFilter])

    return (
        <div className="latest-search__filters-wrapper">
            <div className="latest-search__filters">
                <div className="latest-search__topic-pills">
                    <ScrollMenu
                        LeftArrow={LeftArrow}
                        RightArrow={RightArrow}
                        apiRef={apiRef}
                    >
                        {[
                            <TopicPill
                                key="all"
                                itemId="all"
                                className={cx("latest-search__topic-pill", {
                                    "latest-search__topic-pill--all-active":
                                        selectedTopics.length === 0,
                                })}
                                onClick={() => onTopicsChange([])}
                            >
                                All
                            </TopicPill>,
                            ...topics.map((topic) => {
                                const isSelected =
                                    selectedTopics.includes(topic)
                                const isDisabled = disabledTopics.has(topic)
                                return (
                                    <TopicPill
                                        key={topic}
                                        itemId={topic}
                                        className={cx(
                                            "latest-search__topic-pill",
                                            {
                                                "latest-search__topic-pill--active":
                                                    isSelected,
                                                "latest-search__topic-pill--disabled":
                                                    isDisabled,
                                            }
                                        )}
                                        onClick={() => handleTopicToggle(topic)}
                                        disabled={isDisabled}
                                    >
                                        {topic}
                                    </TopicPill>
                                )
                            }),
                        ]}
                    </ScrollMenu>
                </div>
                <div className="latest-search__content-type-dropdown">
                    <button
                        className={cx("latest-search__content-type-trigger", {
                            "latest-search__content-type-trigger--active":
                                selectedFilter !== null,
                        })}
                        onClick={() =>
                            setIsContentTypeDropdownOpen(
                                !isContentTypeDropdownOpen
                            )
                        }
                        aria-expanded={isContentTypeDropdownOpen}
                        aria-haspopup="listbox"
                    >
                        <FontAwesomeIcon
                            icon={faFilter}
                            className="latest-search__content-type-trigger-icon"
                        />
                        <span className="latest-search__content-type-trigger-label">
                            {contentTypeLabel}
                        </span>
                        <FontAwesomeIcon
                            icon={faCaretDown}
                            className={cx(
                                "latest-search__content-type-trigger-chevron",
                                {
                                    "latest-search__content-type-trigger-chevron--open":
                                        isContentTypeDropdownOpen,
                                }
                            )}
                        />
                    </button>
                    {isContentTypeDropdownOpen && (
                        <>
                            <div
                                className="latest-search__content-type-dropdown-backdrop"
                                onClick={() =>
                                    setIsContentTypeDropdownOpen(false)
                                }
                            />
                            <ul
                                className="latest-search__content-type-dropdown-menu"
                                role="listbox"
                            >
                                <li
                                    className={cx(
                                        "latest-search__content-type-dropdown-item",
                                        {
                                            "latest-search__content-type-dropdown-item--active":
                                                selectedFilter === null,
                                        }
                                    )}
                                    role="option"
                                    aria-selected={selectedFilter === null}
                                    onClick={() => {
                                        onFilterChange(null)
                                        setIsContentTypeDropdownOpen(false)
                                    }}
                                >
                                    <span
                                        className={cx(
                                            "latest-search__content-type-radio",
                                            {
                                                "latest-search__content-type-radio--checked":
                                                    selectedFilter === null,
                                            }
                                        )}
                                    >
                                        {selectedFilter === null && (
                                            <span className="latest-search__content-type-radio-dot" />
                                        )}
                                    </span>
                                    <span className="latest-search__content-type-dropdown-label">
                                        All
                                    </span>
                                </li>
                                {ALL_FILTER_OPTIONS.map((option) => {
                                    const isActive = filtersAreEqual(
                                        selectedFilter,
                                        option.filter
                                    )
                                    const isDisabled = disabledFilters.has(
                                        encodeFilter(option.filter)
                                    )
                                    return (
                                        <li
                                            key={encodeFilter(option.filter)}
                                            className={cx(
                                                "latest-search__content-type-dropdown-item",
                                                {
                                                    "latest-search__content-type-dropdown-item--active":
                                                        isActive,
                                                    "latest-search__content-type-dropdown-item--disabled":
                                                        isDisabled,
                                                }
                                            )}
                                            role="option"
                                            aria-selected={isActive}
                                            aria-disabled={isDisabled}
                                            onClick={
                                                isDisabled
                                                    ? undefined
                                                    : () => {
                                                          onFilterChange(
                                                              isActive
                                                                  ? null
                                                                  : option.filter
                                                          )
                                                          setIsContentTypeDropdownOpen(
                                                              false
                                                          )
                                                      }
                                            }
                                        >
                                            <span
                                                className={cx(
                                                    "latest-search__content-type-radio",
                                                    {
                                                        "latest-search__content-type-radio--checked":
                                                            isActive,
                                                    }
                                                )}
                                            >
                                                {isActive && (
                                                    <span className="latest-search__content-type-radio-dot" />
                                                )}
                                            </span>
                                            <span className="latest-search__content-type-dropdown-label">
                                                {option.label}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
