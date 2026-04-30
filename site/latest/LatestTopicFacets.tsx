import React, {
    useCallback,
    useContext,
    useEffect,
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
import { LATEST_TYPE_VALUES, LatestType } from "@ourworldindata/types"
import { latestTypeLabelPlural } from "./latestUtils.js"

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
            className="latest-topic-facets__scroll-arrow latest-topic-facets__scroll-arrow--left"
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
            className="latest-topic-facets__scroll-arrow latest-topic-facets__scroll-arrow--right"
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
    selectedType,
    onLatestTypeChange,
    disabledTypes,
    disabledTopics,
}: {
    topics: string[]
    selectedTopics: string[]
    onTopicsChange: (topics: string[]) => void
    selectedType: LatestType | null
    onLatestTypeChange: (type: LatestType | null) => void
    disabledTypes: Set<LatestType>
    disabledTopics: Set<string>
}) => {
    const [isContentTypeDropdownOpen, setIsContentTypeDropdownOpen] =
        useState(false)

    type ScrollApiType = React.ContextType<typeof VisibilityContext>
    const apiRef = useRef({} as ScrollApiType)

    // Topic selection on /latest is single-select in the UI: clicking a
    // topic replaces the current selection (or clears it when re-clicked).
    // The underlying state and query layers still model topics as a
    // multi-value array with disjunctive (OR) semantics — matching /search,
    // which uses the same `formatTopicFacetFilters` helper. Keeping that
    // shape preserves parity if multi-select is ever added back.
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

    return (
        <div className="latest-topic-facets">
            <div className="latest-topic-facets__filters">
                <div className="latest-topic-facets__topic-pills">
                    <ScrollMenu
                        LeftArrow={LeftArrow}
                        RightArrow={RightArrow}
                        apiRef={apiRef}
                    >
                        {[
                            <TopicPill
                                key="all"
                                itemId="all"
                                className={cx(
                                    "latest-topic-facets__topic-pill",
                                    {
                                        "latest-topic-facets__topic-pill--all-active":
                                            selectedTopics.length === 0,
                                    }
                                )}
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
                                            "latest-topic-facets__topic-pill",
                                            {
                                                "latest-topic-facets__topic-pill--active":
                                                    isSelected,
                                                "latest-topic-facets__topic-pill--disabled":
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
                <div className="latest-topic-facets__content-type-dropdown">
                    <button
                        className={cx(
                            "latest-topic-facets__content-type-trigger",
                            {
                                "latest-topic-facets__content-type-trigger--active":
                                    selectedType !== null,
                            }
                        )}
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
                            className="latest-topic-facets__content-type-trigger-icon"
                        />
                        <span className="latest-topic-facets__content-type-trigger-label">
                            {selectedType
                                ? latestTypeLabelPlural(selectedType)
                                : "Filter by type"}
                        </span>
                        <FontAwesomeIcon
                            icon={faCaretDown}
                            className={cx(
                                "latest-topic-facets__content-type-trigger-chevron",
                                {
                                    "latest-topic-facets__content-type-trigger-chevron--open":
                                        isContentTypeDropdownOpen,
                                }
                            )}
                        />
                    </button>
                    {isContentTypeDropdownOpen && (
                        <>
                            <div
                                className="latest-topic-facets__content-type-dropdown-backdrop"
                                onClick={() =>
                                    setIsContentTypeDropdownOpen(false)
                                }
                            />
                            <ul
                                className="latest-topic-facets__content-type-dropdown-menu"
                                role="listbox"
                            >
                                <li
                                    className={cx(
                                        "latest-topic-facets__content-type-dropdown-item",
                                        {
                                            "latest-topic-facets__content-type-dropdown-item--active":
                                                selectedType === null,
                                        }
                                    )}
                                    role="option"
                                    aria-selected={selectedType === null}
                                    onClick={() => {
                                        onLatestTypeChange(null)
                                        setIsContentTypeDropdownOpen(false)
                                    }}
                                >
                                    <span
                                        className={cx(
                                            "latest-topic-facets__content-type-radio",
                                            {
                                                "latest-topic-facets__content-type-radio--checked":
                                                    selectedType === null,
                                            }
                                        )}
                                    >
                                        {selectedType === null && (
                                            <span className="latest-topic-facets__content-type-radio-dot" />
                                        )}
                                    </span>
                                    <span className="latest-topic-facets__content-type-dropdown-label">
                                        All
                                    </span>
                                </li>
                                {LATEST_TYPE_VALUES.map((value) => {
                                    const isActive = selectedType === value
                                    const isDisabled = disabledTypes.has(value)
                                    return (
                                        <li
                                            key={value}
                                            className={cx(
                                                "latest-topic-facets__content-type-dropdown-item",
                                                {
                                                    "latest-topic-facets__content-type-dropdown-item--active":
                                                        isActive,
                                                    "latest-topic-facets__content-type-dropdown-item--disabled":
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
                                                          onLatestTypeChange(
                                                              isActive
                                                                  ? null
                                                                  : value
                                                          )
                                                          setIsContentTypeDropdownOpen(
                                                              false
                                                          )
                                                      }
                                            }
                                        >
                                            <span
                                                className={cx(
                                                    "latest-topic-facets__content-type-radio",
                                                    {
                                                        "latest-topic-facets__content-type-radio--checked":
                                                            isActive,
                                                    }
                                                )}
                                            >
                                                {isActive && (
                                                    <span className="latest-topic-facets__content-type-radio-dot" />
                                                )}
                                            </span>
                                            <span className="latest-topic-facets__content-type-dropdown-label">
                                                {latestTypeLabelPlural(value)}
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
