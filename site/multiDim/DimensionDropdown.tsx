import {
    faCaretDown,
    faCheck,
    faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "clsx"
import { useCallback, useMemo, useRef, useState } from "react"
import {
    Autocomplete,
    Select,
    Button,
    Popover,
    ListBox,
    ListBoxSection,
    Header,
    Collection,
    ListBoxItem,
    SearchField,
    Input,
} from "react-aria-components"
import { useMediaQuery } from "usehooks-ts"

import { Choice, DimensionEnriched } from "@ourworldindata/types"
import { FuzzySearch } from "@ourworldindata/utils"
import { TOUCH_DEVICE_MEDIA_QUERY } from "../SiteConstants.js"
import DimensionLabel from "./DimensionLabel.js"

function DimensionItem({ choice }: { choice: Choice }) {
    return (
        <ListBoxItem
            className="md-menu__item"
            id={choice.slug}
            textValue={choice.name}
        >
            {({ isSelected }) => (
                <>
                    <span className="md-menu__item-content">
                        <span className="md-menu__item-label">
                            {choice.name}
                        </span>
                        {choice.description && (
                            <span className="md-menu__item-description">
                                {choice.description}
                            </span>
                        )}
                    </span>
                    {isSelected && (
                        <FontAwesomeIcon
                            className="md-menu__item-check"
                            icon={faCheck}
                        />
                    )}
                </>
            )}
        </ListBoxItem>
    )
}

export default function DimensionDropdown({
    className,
    dimension,
    value,
    onChange,
    readOnly,
    showSearch,
}: {
    className?: string
    dimension: DimensionEnriched
    value: string
    onChange: (value: string) => void
    readOnly?: boolean
    showSearch?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false)
    // Don't autofocus the search field on touch devices, where it would pop
    // up the virtual keyboard and cover the menu.
    const isTouchDevice = useMediaQuery(TOUCH_DEVICE_MEDIA_QUERY)

    // Match on choice names and their group names, so e.g. searching for a
    // group shows all of the group's choices.
    const fuzzySearch = useMemo(
        () =>
            FuzzySearch.withKeyArray(
                dimension.choices,
                (choice) =>
                    choice.group ? [choice.name, choice.group] : [choice.name],
                (choice) => choice.slug
            ),
        [dimension.choices]
    )
    // The filter is called once per menu item, so cache the fuzzy search
    // results per query.
    const matchesRef = useRef<{ query: string; names: Set<string> }>({
        query: "",
        names: new Set(),
    })
    const filter = useCallback(
        (textValue: string, inputValue: string): boolean => {
            if (!inputValue) return true
            if (matchesRef.current.query !== inputValue) {
                matchesRef.current = {
                    query: inputValue,
                    names: new Set(
                        fuzzySearch
                            .search(inputValue)
                            .map((choice) => choice.name)
                    ),
                }
            }
            return matchesRef.current.names.has(textValue)
        },
        [fuzzySearch]
    )

    const listBox = (
        <ListBox
            renderEmptyState={() => (
                <div className="md-menu__empty">No matching options</div>
            )}
        >
            {Object.entries(dimension.choicesByGroup).map(
                ([groupLabel, groupChoices]) =>
                    groupLabel !== "undefined" ? (
                        <ListBoxSection
                            key={groupLabel}
                            className="md-menu__group"
                        >
                            <Header className="md-menu__group-label">
                                {groupLabel}
                            </Header>
                            <Collection>
                                {groupChoices.map((choice) => (
                                    <DimensionItem
                                        key={choice.slug}
                                        choice={choice}
                                    />
                                ))}
                            </Collection>
                        </ListBoxSection>
                    ) : (
                        groupChoices.map((choice) => (
                            <DimensionItem key={choice.slug} choice={choice} />
                        ))
                    )
            )}
        </ListBox>
    )

    return (
        <Select
            className={cx(
                "md-settings__control",
                "md-settings__dropdown",
                className
            )}
            isDisabled={dimension.choices.length === 1}
            isOpen={isOpen}
            // While a view is loading (readOnly), don't open the menu, but
            // always allow closing it. Disabling the whole select instead
            // would make the trigger unfocusable and drop keyboard focus.
            onOpenChange={(open) => {
                if (!open || !readOnly) setIsOpen(open)
            }}
            value={value}
            onChange={(key) => {
                if (typeof key === "string" && !readOnly) onChange(key)
            }}
        >
            <DimensionLabel dimension={dimension} />
            <Button
                className="md-settings__dropdown-toggle"
                data-track-note="multi-dim-choice-dropdown"
            >
                <span className="md-settings__dropdown-current-choice">
                    {dimension.choicesBySlug[value].name}
                </span>
                <div className="md-settings__dropdown-caret">
                    {/* The div is neccesary to keep the icon `display: inline`,
            so it aligns with the text correctly. */}
                    <FontAwesomeIcon icon={faCaretDown} />
                </div>
            </Button>
            <Popover
                className={cx("md-menu", {
                    "md-menu--searchable": showSearch,
                })}
                // Avoid multiple of 4 to increase the chance the next option is
                // partially visible when scrolling is required.
                maxHeight={393}
                placement="bottom start"
                offset={4}
            >
                {!showSearch && (
                    <div className="md-menu__overlay-header">
                        <h2 className="md-menu__overlay-header-title">
                            {dimension.name}
                        </h2>
                        {dimension.description && (
                            <p className="md-menu__dimension-description">
                                {dimension.description}
                            </p>
                        )}
                    </div>
                )}
                {showSearch ? (
                    <Autocomplete filter={filter}>
                        <SearchField
                            className="md-menu__search"
                            aria-label={`Search ${dimension.name}`}
                            autoFocus={!isTouchDevice}
                        >
                            <FontAwesomeIcon
                                className="md-menu__search-icon"
                                icon={faMagnifyingGlass}
                            />
                            <Input
                                className="md-menu__search-input"
                                placeholder="Search"
                            />
                        </SearchField>
                        {listBox}
                    </Autocomplete>
                ) : (
                    listBox
                )}
            </Popover>
        </Select>
    )
}
