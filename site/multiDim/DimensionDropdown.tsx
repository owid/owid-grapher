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
} from "react-aria-components"

import { CloseButton } from "@ourworldindata/components"
import { Choice, DimensionEnriched } from "@ourworldindata/types"
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
                    <span className="md-menu__item-label">{choice.name}</span>
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
                <div className="md-menu__overlay-header">
                    <div>
                        <h2 className="md-menu__overlay-header-title">
                            {dimension.name}
                        </h2>
                        {dimension.description && (
                            <p className="md-menu__dimension-description">
                                {dimension.description}
                            </p>
                        )}
                    </div>
                    <CloseButton
                        className="md-menu__overlay-header-close-button"
                        onClick={() => setIsOpen(false)}
                    />
                </div>
                <ListBox>
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
                                    <DimensionItem
                                        key={choice.slug}
                                        choice={choice}
                                    />
                                ))
                            )
                    )}
                </ListBox>
            </Popover>
        </Select>
    )
}
