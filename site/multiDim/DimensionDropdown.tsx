import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
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
import * as _ from "lodash-es"

import { OverlayHeader, RadioButton } from "@ourworldindata/components"
import { Choice, DimensionEnriched } from "@ourworldindata/types"
import { useState } from "react"

function DimensionItem({ choice }: { choice: Choice }) {
    return (
        <ListBoxItem
            className="md-menu__radio-button"
            id={choice.slug}
            textValue={choice.name}
        >
            {({ isSelected }) => (
                <RadioButton
                    checked={isSelected}
                    onChange={_.noop}
                    label={
                        <>
                            <Text className="md-label" slot="label">
                                {choice.name}
                            </Text>
                            {choice.description && (
                                <Text
                                    className="md-description"
                                    slot="description"
                                >
                                    {choice.description}
                                </Text>
                            )}
                        </>
                    }
                />
            )}
        </ListBoxItem>
    )
}

export default function DimensionDropdown({
    dimension,
    value,
    onChange,
}: {
    dimension: DimensionEnriched
    value: string
    onChange: (value: string) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const isDisabled = dimension.choices.length === 1
    return (
        <Select
            className="md-settings__dropdown"
            isDisabled={isDisabled}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            selectedKey={value}
            onSelectionChange={(key) => {
                if (typeof key === "string") onChange(key)
            }}
            aria-label={dimension.name}
        >
            <Button
                className="md-settings__dropdown-toggle"
                data-track-note="multi-dim-choice-dropdown"
            >
                <span className="md-settings__dropdown-label">
                    {dimension.name}
                </span>
                <span className="md-settings__dropdown-current-choice">
                    {dimension.choicesBySlug[value].name}
                </span>
                <div>
                    {/* The div is neccesary to keep the icon `display: inline`,
            so it aligns with the text correctly. */}
                    <FontAwesomeIcon icon={faCaretDown} />
                </div>
            </Button>
            <Popover
                className="md-menu"
                maxHeight={400}
                placement="bottom start"
                offset={4}
            >
                <OverlayHeader
                    title={dimension.name}
                    onDismiss={() => setIsOpen(false)}
                />
                {dimension.description && (
                    <p className="md-description menu-dimension__description">
                        {dimension.description}
                    </p>
                )}
                <ListBox className="md-menu__options">
                    {Object.entries(dimension.choicesByGroup).map(
                        ([groupLabel, groupChoices]) =>
                            groupLabel !== "undefined" ? (
                                <ListBoxSection
                                    key={groupLabel}
                                    className="md-menu__group is-group"
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
