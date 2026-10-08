import {
    faCaretDown,
    faCheck,
    faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "clsx"
import { useCallback, useMemo, useState } from "react"
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
    type Key,
} from "react-aria-components"
import { useMediaQuery } from "usehooks-ts"

import { Choice, DimensionEnriched } from "@ourworldindata/types"
import { FuzzySearch } from "@ourworldindata/utils"
import { TOUCH_DEVICE_MEDIA_QUERY } from "../SiteConstants.js"
import DimensionLabel from "./DimensionLabel.js"

function DimensionItem({ choice }: { choice: Choice }) {
    return (
        <ListBoxItem
            className="md-menu__item label-2-regular"
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
                            <span className="md-menu__item-description note-2-regular">
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
    const [searchQuery, setSearchQuery] = useState("")
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
    // The filter runs once per menu item, so search once per query instead.
    const matchingSlugs = useMemo(
        () =>
            searchQuery
                ? new Set<Key>(
                      fuzzySearch
                          .search(searchQuery)
                          .map((choice) => choice.slug)
                  )
                : undefined,
        [fuzzySearch, searchQuery]
    )
    // Match on the item's key, i.e. the choice slug: two groups can hold
    // choices that share a name, and only one of them may be a match.
    const filter = useCallback(
        (
            _textValue: string,
            _inputValue: string,
            node: { key: Key }
        ): boolean => !matchingSlugs || matchingSlugs.has(node.key),
        [matchingSlugs]
    )

    const listBox = (
        <ListBox
            className="md-menu__list"
            renderEmptyState={() => (
                <div className="md-menu__empty label-2-regular">
                    No matching options
                </div>
            )}
        >
            {Object.entries(dimension.choicesByGroup).map(
                ([groupLabel, groupChoices]) => (
                    // Choices without a group end up in a single
                    // section keyed "undefined", which has no label.
                    <ListBoxSection key={groupLabel} className="md-menu__group">
                        {groupLabel !== "undefined" && (
                            <Header className="md-menu__group-label label-2-bold">
                                {groupLabel}
                            </Header>
                        )}
                        <Collection>
                            {groupChoices.map((choice) => (
                                <DimensionItem
                                    key={choice.slug}
                                    choice={choice}
                                />
                            ))}
                        </Collection>
                    </ListBoxSection>
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
                // The menu unmounts on close, but this state doesn't, so the
                // next opening would start with the old query.
                if (!open) setSearchQuery("")
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
                        <h2 className="md-menu__overlay-header-title h5-black-caps">
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
                    <Autocomplete
                        filter={filter}
                        inputValue={searchQuery}
                        onInputChange={setSearchQuery}
                    >
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
