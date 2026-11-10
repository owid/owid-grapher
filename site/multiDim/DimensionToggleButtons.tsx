import cx from "clsx"
import { useId, type Ref } from "react"
import {
    Key,
    LabelContext,
    ToggleButton,
    ToggleButtonGroup,
} from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"
import DimensionLabel from "./DimensionLabel.js"

// A segmented toggle group, exposed to assistive technology as a radio group.
// It's a React Aria ToggleButtonGroup in single selection mode rather than a
// RadioGroup, so that the arrow keys only move focus and Space/Enter selects.
export default function DimensionToggleButtons({
    className,
    dimension,
    availableChoiceSlugs,
    value,
    onChange,
    readOnly,
}: {
    className?: string
    dimension: DimensionEnriched
    availableChoiceSlugs: Set<string>
    value: string
    onChange: (value: string) => void
    readOnly?: boolean
}) {
    const id = useId()
    const labelId = `${id}-label`
    const availableCount = dimension.choices.filter((choice) =>
        availableChoiceSlugs.has(choice.slug)
    ).length
    // With at most one selectable option there's nothing to switch between,
    // so disable the whole control.
    const isDisabled = availableCount <= 1
    return (
        <div
            className={cx(
                "md-settings__control",
                "md-settings__toggle-group",
                className
            )}
            data-disabled={isDisabled || undefined}
        >
            {/* The group has no label slot, so wire the label up by hand. */}
            <LabelContext.Provider value={{ id: labelId, elementType: "span" }}>
                <DimensionLabel dimension={dimension} showChoiceDescriptions />
            </LabelContext.Provider>
            <ToggleButtonGroup
                className="md-settings__toggle-group-options"
                aria-labelledby={labelId}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[value]}
                onSelectionChange={(keys: Set<Key>) => {
                    // While a view is loading, ignore changes rather than
                    // disabling the group: disabling would make the focused
                    // option unfocusable and drop keyboard focus.
                    if (readOnly) return
                    const [key] = keys
                    if (key !== undefined) onChange(String(key))
                }}
                isDisabled={isDisabled}
            >
                {dimension.choices.map((choice) => {
                    const descriptionId = `${id}-description-${choice.slug}`
                    return (
                        <div
                            key={choice.slug}
                            className="md-settings__toggle-field"
                        >
                            <ToggleButton
                                id={choice.slug}
                                className="md-settings__toggle"
                                data-track-note="multi-dim-choice-toggle"
                                isDisabled={
                                    !availableChoiceSlugs.has(choice.slug)
                                }
                                // Like in a native radio group, Tab only
                                // stops at the selected option, and the
                                // arrow keys reach the others.
                                excludeFromTabOrder={choice.slug !== value}
                                aria-describedby={
                                    choice.description
                                        ? descriptionId
                                        : undefined
                                }
                            >
                                <span
                                    className="md-settings__toggle-label"
                                    title={choice.name}
                                >
                                    {choice.name}
                                </span>
                            </ToggleButton>
                            {/* Sighted users find choice descriptions in the label's
                                info tooltip; screen readers read them with the option.
                                Hidden, so that it's only announced as the option's
                                description: aria-describedby resolves hidden targets. */}
                            {choice.description && (
                                <span id={descriptionId} hidden>
                                    {choice.description}
                                </span>
                            )}
                        </div>
                    )
                })}
            </ToggleButtonGroup>
        </div>
    )
}

// A hidden copy of the options at their natural width, measured to decide
// whether the toggle buttons fit the controls row (see
// MeasuredDimensionToggleButtons). It mirrors the options' markup above with
// the same classes, so anything that changes an option's width (an icon,
// say) has to be added here too.
export function DimensionToggleButtonsSizer({
    dimension,
    ref,
}: {
    dimension: DimensionEnriched
    ref: Ref<HTMLDivElement>
}) {
    return (
        <div
            className="md-settings__toggle-group-options md-toggle-measure"
            aria-hidden="true"
            ref={ref}
        >
            {dimension.choices.map((choice) => (
                <div key={choice.slug} className="md-settings__toggle-field">
                    <span className="md-settings__toggle">
                        <span className="md-settings__toggle-label">
                            {choice.name}
                        </span>
                    </span>
                </div>
            ))}
        </div>
    )
}
