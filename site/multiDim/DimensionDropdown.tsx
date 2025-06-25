import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"
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
import * as _ from "lodash-es"

import { CloseButton, RadioButton } from "@ourworldindata/components"
import { Choice, DimensionEnriched } from "@ourworldindata/types"

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
    className,
    dimension,
    value,
    onChange,
}: {
    className?: string
    dimension: DimensionEnriched
    value: string
    onChange: (value: string) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const isDisabled = dimension.choices.length === 1
    return (
        <Select
            className={cx("md-settings__dropdown", className)}
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
