import React, { useCallback, useContext, useEffect, useRef } from "react"
import cx from "clsx"
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
    ToggleButton,
    ToggleButtonGroup,
    type Key,
    type ToggleButtonProps,
} from "react-aria-components"
import { LATEST_TYPE_VALUES, LatestType } from "@ourworldindata/types"
import { latestTypeLabelPlural } from "./latestUtils.js"

/**
 * Wrapper that accepts the `itemId` prop required by
 * react-horizontal-scrolling-menu while rendering a react-aria ToggleButton.
 */
const TopicPill = ({
    itemId: _itemId,
    ...props
}: { itemId: string } & ToggleButtonProps) => {
    return <ToggleButton {...props} />
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
    ariaLabel,
}: {
    id: string
    label: string
    ariaLabel?: string
}) => {
    return (
        <ListBoxItem
            id={id}
            textValue={label}
            aria-label={ariaLabel}
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
    const selectedKeys =
        selectedTopics.length === 0
            ? new Set<Key>(["all"])
            : new Set<Key>(selectedTopics)

    const handleSelectionChange = useCallback(
        (keys: Set<Key>) => {
            // "all" is a synthetic key for the All pill — strip it before
            // propagating, since `selectedTopics` represents that state as [].
            const next = [...keys]
                .filter((k) => k !== "all")
                .map((k) => String(k))
            onTopicsChange(next)
            const focusKey = next[0]
            if (focusKey) {
                const item = apiRef.current.getItemById?.(focusKey)
                if (item) {
                    apiRef.current.scrollToItem(item, "smooth", "center")
                }
            }
        },
        [onTopicsChange]
    )

    const handlePillFocus = useCallback((id: string) => {
        const item = apiRef.current.getItemById?.(id)
        if (item) {
            apiRef.current.scrollToItem(item, "smooth", "nearest")
        }
    }, [])

    // Scroll the selected topic into view on initial load. The ScrollMenu
    // registers items and their visibility asynchronously via an
    // IntersectionObserver, so on mount `getItemById` may return an item whose
    // `entry` is not yet populated — and `scrollToItem` silently no-ops without
    // it. Retry across a few animation frames until the item is measured, then
    // scroll once.
    useEffect(() => {
        const topic = selectedTopics[0]
        if (!topic) return
        let rafId = 0
        let attempts = 0
        const MAX_ATTEMPTS = 30
        const tryScroll = () => {
            const item = apiRef.current.getItemById?.(topic)
            if (item?.entry) {
                apiRef.current.scrollToItem(item, "smooth", "center")
                return
            }
            if (attempts++ < MAX_ATTEMPTS) {
                rafId = requestAnimationFrame(tryScroll)
            }
        }
        rafId = requestAnimationFrame(tryScroll)
        return () => cancelAnimationFrame(rafId)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="latest-topic-facets">
            <div className="latest-topic-facets__filters">
                <ToggleButtonGroup
                    className="latest-topic-facets__topic-pills"
                    selectionMode="single"
                    selectedKeys={selectedKeys}
                    onSelectionChange={handleSelectionChange}
                >
                    <ScrollMenu
                        LeftArrow={LeftArrow}
                        RightArrow={RightArrow}
                        apiRef={apiRef}
                    >
                        {[
                            <TopicPill
                                key="all"
                                itemId="all"
                                id="all"
                                className="latest-topic-facets__topic-pill"
                                onFocus={() => handlePillFocus("all")}
                                aria-label="All topics"
                            >
                                All
                            </TopicPill>,
                            ...topics.map((topic) => (
                                <TopicPill
                                    key={topic}
                                    itemId={topic}
                                    id={topic}
                                    className="latest-topic-facets__topic-pill"
                                    isDisabled={disabledTopics.has(topic)}
                                    onFocus={() => handlePillFocus(topic)}
                                >
                                    {topic}
                                </TopicPill>
                            )),
                        ]}
                    </ScrollMenu>
                </ToggleButtonGroup>
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
                            <ContentTypeListBoxItem
                                id="all"
                                label="All"
                                ariaLabel="All types"
                            />
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
