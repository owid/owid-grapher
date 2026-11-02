import { faCaretDown, faCheck } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "clsx"
import { useState } from "react"
import {
    Select,
    Button,
    Popover,
    ListBox,
    ListBoxSection,
    Header,
    Collection,
    ListBoxItem,
    Text,
} from "react-aria-components"

import { Choice, DimensionEnriched } from "@ourworldindata/types"
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
                    {/* The slots wire up the option's aria-labelledby and
                        aria-describedby, so screen readers announce the
                        description too. */}
                    <span className="md-menu__item-content">
                        <Text slot="label">{choice.name}</Text>
                        {choice.description && (
                            <Text
                                slot="description"
                                className="md-menu__item-description note-2-regular"
                            >
                                {choice.description}
                            </Text>
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
}: {
    className?: string
    dimension: DimensionEnriched
    value: string
    onChange: (value: string) => void
    readOnly?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false)
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
                className="md-menu"
                // Avoid multiple of 4 to increase the chance the next option is
                // partially visible when scrolling is required.
                maxHeight={393}
                placement="bottom start"
                offset={4}
            >
                <ListBox className="md-menu__list">
                    {Object.entries(dimension.choicesByGroup).map(
                        ([groupLabel, groupChoices]) => (
                            // Choices without a group end up in a single
                            // section keyed "undefined", which has no label.
                            <ListBoxSection
                                key={groupLabel}
                                className={cx("md-menu__group", {
                                    "md-menu__group--labeled":
                                        groupLabel !== "undefined",
                                })}
                            >
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
            </Popover>
        </Select>
    )
}
