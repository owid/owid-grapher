import cx from "clsx"
import { useId } from "react"
import {
    Key,
    LabelContext,
    ToggleButton,
    ToggleButtonGroup,
} from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"
import DimensionLabel from "./DimensionLabel.js"

// A segmented radio group. It's a React Aria ToggleButtonGroup in single
// selection mode rather than a RadioGroup, so that the arrow keys only move
// focus and Space/Enter selects: selecting loads a new view, which shouldn't
// happen for every option that is passed on the way.
export default function DimensionRadioGroup({
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
    // Like in a native radio group, Tab only stops at the selected option,
    // and the arrow keys reach the others. If the selected option can't be
    // focused, every option stays in the tab order.
    const hasRovingTabStop = availableChoiceSlugs.has(value)
    return (
        <div
            className={cx(
                "md-settings__control",
                "md-settings__radio-group",
                className
            )}
            data-disabled={isDisabled || undefined}
        >
            {/* The group has no label slot, so wire the label up by hand. */}
            <LabelContext.Provider value={{ id: labelId, elementType: "span" }}>
                <DimensionLabel dimension={dimension} showChoiceDescriptions />
            </LabelContext.Provider>
            <ToggleButtonGroup
                className="md-settings__radio-group-options"
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
                            className="md-settings__radio-field"
                        >
                            <ToggleButton
                                id={choice.slug}
                                className="md-settings__radio"
                                data-track-note="multi-dim-choice-radio"
                                isDisabled={
                                    !availableChoiceSlugs.has(choice.slug)
                                }
                                excludeFromTabOrder={
                                    hasRovingTabStop && choice.slug !== value
                                }
                                aria-describedby={
                                    choice.description
                                        ? descriptionId
                                        : undefined
                                }
                            >
                                <span
                                    className="md-settings__radio-label"
                                    title={choice.name}
                                >
                                    {choice.name}
                                </span>
                            </ToggleButton>
                            {/* Sighted users find choice descriptions in the label's
                                info tooltip; screen readers read them with the option. */}
                            {choice.description && (
                                <span id={descriptionId} className="sr-only">
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
