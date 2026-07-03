import React, { useCallback, useContext } from "react"
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
} from "react-aria-components"
import { LATEST_TYPE_VALUES, LatestType } from "@ourworldindata/types"
import { latestTypeLabelPlural } from "./latestUtils.js"

/**
 * Wrapper that accepts the `itemId` prop required by
 * react-horizontal-scrolling-menu while rendering a react-aria ToggleButton.
 */
type TopicPillProps = React.ComponentProps<typeof ToggleButton> & {
    itemId: string
}

const TopicPill = ({ itemId: _itemId, ...props }: TopicPillProps) => {
    return <ToggleButton {...props} />
}

function scrollPillIntoView(node: Element | null): void {
    node?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
    })
}

function scrollKeyboardFocusedPillIntoView(
    event: React.FocusEvent<Element>
): void {
    // Pointer focus happens on mouse down. If we scroll the pill at that point,
    // it can move out from under the pointer before mouse up, cancelling the
    // click/selection. Keep this behavior for keyboard focus only.
    if (event.currentTarget.matches(":focus-visible"))
        scrollPillIntoView(event.currentTarget)
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
        },
        [onTopicsChange]
    )

    return (
        <div className="latest-topic-facets">
            <div className="latest-topic-facets__filters">
                <ToggleButtonGroup
                    className="latest-topic-facets__topic-pills"
                    selectionMode="single"
                    selectedKeys={selectedKeys}
                    onSelectionChange={handleSelectionChange}
                >
                    <ScrollMenu LeftArrow={LeftArrow} RightArrow={RightArrow}>
                        {[
                            <TopicPill
                                key="all"
                                itemId="all"
                                id="all"
                                className="latest-topic-facets__topic-pill"
                                onFocus={scrollKeyboardFocusedPillIntoView}
                                aria-label="All topics"
                            >
                                All
                            </TopicPill>,
                            ...topics.map((topic) => (
                                <TopicPill
                                    key={topic}
                                    itemId={topic}
                                    id={topic}
                                    ref={
                                        topic === selectedTopics[0]
                                            ? scrollPillIntoView
                                            : undefined
                                    }
                                    className="latest-topic-facets__topic-pill"
                                    isDisabled={disabledTopics.has(topic)}
                                    onFocus={scrollKeyboardFocusedPillIntoView}
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
