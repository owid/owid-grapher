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
import DisabledReasonTooltip, {
    DISABLED_CONTROL_REASON,
    UNAVAILABLE_OPTION_REASON,
} from "./DisabledReasonTooltip.js"

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
                <DimensionLabel
                    dimension={dimension}
                    showChoiceDescriptions
                    isDisabled={isDisabled}
                />
            </LabelContext.Provider>
            <DisabledReasonTooltip
                reason={isDisabled ? DISABLED_CONTROL_REASON : undefined}
            >
                <ToggleButtonOptions
                    dimension={dimension}
                    aria-labelledby={labelId}
                    availableChoiceSlugs={availableChoiceSlugs}
                    value={value}
                    onChange={(newValue) => {
                        // While a view is loading, ignore changes rather than
                        // disabling the group: disabling would make the focused
                        // option unfocusable and drop keyboard focus.
                        if (!readOnly) onChange(newValue)
                    }}
                    isDisabled={isDisabled}
                />
            </DisabledReasonTooltip>
        </div>
    )
}

// The group and its options: the part of the control whose width matters.
// Besides the live control, MeasuredDimensionToggleButtons renders a hidden
// instance of it, without a selection, to measure the width the options need.
export function ToggleButtonOptions({
    className,
    dimension,
    availableChoiceSlugs,
    value,
    onChange,
    isDisabled,
    inert,
    ref,
    "aria-labelledby": ariaLabelledBy,
}: {
    className?: string
    dimension: DimensionEnriched
    // All choices count as available when omitted.
    availableChoiceSlugs?: Set<string>
    value?: string
    onChange?: (value: string) => void
    isDisabled: boolean
    inert?: boolean
    ref?: Ref<HTMLDivElement>
    "aria-labelledby"?: string
}) {
    const id = useId()
    return (
        <ToggleButtonGroup
            className={cx("md-settings__toggle-group-options", className)}
            aria-labelledby={ariaLabelledBy}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={value === undefined ? [] : [value]}
            onSelectionChange={(keys: Set<Key>) => {
                const [key] = keys
                if (key !== undefined) onChange?.(String(key))
            }}
            isDisabled={isDisabled}
            inert={inert}
            ref={ref}
        >
            {dimension.choices.map((choice) => {
                const descriptionId = `${id}-description-${choice.slug}`
                const isChoiceUnavailable =
                    availableChoiceSlugs !== undefined &&
                    !availableChoiceSlugs.has(choice.slug)
                return (
                    // The tooltip hangs off the field rather than the button:
                    // a disabled button doesn't get mouse events. In case the
                    // whole group is disabled, the group's own tooltip
                    // explains it instead.
                    <DisabledReasonTooltip
                        key={choice.slug}
                        reason={
                            isChoiceUnavailable && !isDisabled
                                ? UNAVAILABLE_OPTION_REASON
                                : undefined
                        }
                    >
                        <div className="md-settings__toggle-field">
                            <ToggleButton
                                id={choice.slug}
                                className="md-settings__toggle"
                                data-track-note="multi-dim-choice-toggle"
                                isDisabled={isChoiceUnavailable}
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
                                    // The native tooltip would compete with
                                    // the reason one.
                                    title={
                                        isChoiceUnavailable
                                            ? undefined
                                            : choice.name
                                    }
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
                    </DisabledReasonTooltip>
                )
            })}
        </ToggleButtonGroup>
    )
}
