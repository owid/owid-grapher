import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import * as _ from "lodash-es"
import { useMemo, useState } from "react"
import {
    Button,
    Collection,
    Header,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Popover,
    Select,
    Text,
} from "react-aria-components"
import { OverlayHeader, RadioButton } from "@ourworldindata/components"
import {
    Choice,
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"

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

function DimensionDropdown({
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
                <FontAwesomeIcon icon={faCaretDown} />
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

export const MultiDimSettingsPanel = ({
    className,
    config,
    settings,
    onChange,
}: {
    className?: string
    config: MultiDimDataPageConfig
    settings: MultiDimDimensionChoices
    onChange: (settings: MultiDimDimensionChoices) => void
}) => {
    const { dimensions } = config

    // Non-partial version of `settings` with all dimensions filled in
    const resolvedSettings = useMemo(
        () =>
            _.mapValues(
                dimensions,
                (dim) =>
                    settings[dim.slug] ?? Object.values(dim.choices)[0].slug
            ),
        [settings, dimensions]
    )

    const availableSettings = useMemo(() => {
        return config.filterToAvailableChoices(resolvedSettings)
            .dimensionsWithAvailableChoices
    }, [resolvedSettings, config])

    return (
        <div className={cx("md-settings-row", className)}>
            <div className="h5-black-caps md-settings__configure-data">
                Configure the data
            </div>
            <div className="md-settings__dropdowns">
                {Object.values(availableSettings).map((dim) => (
                    <DimensionDropdown
                        key={dim.slug}
                        dimension={dim}
                        value={resolvedSettings[dim.slug]}
                        onChange={(value) => {
                            onChange({
                                ...resolvedSettings,
                                [dim.slug]: value,
                            })
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
