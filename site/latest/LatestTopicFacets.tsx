import React, { useCallback, useContext, useEffect, useRef } from "react"
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
    Button,
    ListBox,
    ListBoxItem,
    Popover,
    Select,
} from "react-aria-components"
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

const ContentTypeListBoxItem = ({
    id,
    label,
}: {
    id: string
    label: string
}) => {
    return (
        <ListBoxItem
            id={id}
            textValue={label}
            className="latest-topic-facets__content-type-dropdown-item"
        >
            {({ isSelected }) => (
                <>
                    <span
                        className={cx(
                            "latest-topic-facets__content-type-radio",
                            {
                                "latest-topic-facets__content-type-radio--checked":
                                    isSelected,
                            }
                        )}
                    >
                        {isSelected && (
                            <span className="latest-topic-facets__content-type-radio-dot" />
                        )}
                    </span>
                    <span className="latest-topic-facets__content-type-dropdown-label">
                        {label}
                    </span>
                </>
            )}
        </ListBoxItem>
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
                <Select
                    className="latest-topic-facets__content-type-dropdown"
                    value={selectedType ?? "all"}
                    onChange={(key) =>
                        onLatestTypeChange(
                            key === "all" || key === null
                                ? null
                                : (key as LatestType)
                        )
                    }
                    disabledKeys={disabledTypes}
                    aria-label="Filter by content type"
                >
                    <Button className="latest-topic-facets__content-type-trigger">
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
                            className="latest-topic-facets__content-type-trigger-chevron"
                        />
                    </Button>
                    <Popover
                        className="latest-topic-facets__content-type-dropdown-menu"
                        placement="bottom start"
                        offset={4}
                    >
                        <ListBox>
                            <ContentTypeListBoxItem id="all" label="All" />
                            {LATEST_TYPE_VALUES.map((value) => (
                                <ContentTypeListBoxItem
                                    key={value}
                                    id={value}
                                    label={latestTypeLabelPlural(value)}
                                />
                            ))}
                        </ListBox>
                    </Popover>
                </Select>
            </div>
        </div>
    )
}
