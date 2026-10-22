import cx from "clsx"
import { RadioButton, RadioField, RadioGroup } from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"
import DimensionLabel from "./DimensionLabel.js"
import DisabledReasonTooltip, {
    DISABLED_CONTROL_REASON,
    UNAVAILABLE_OPTION_REASON,
} from "./DisabledReasonTooltip.js"

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
    const availableCount = dimension.choices.filter((choice) =>
        availableChoiceSlugs.has(choice.slug)
    ).length
    // With at most one selectable option there's nothing to switch between,
    // so disable the whole control.
    const isGroupDisabled = availableCount <= 1
    return (
        <RadioGroup
            className={cx(
                "md-settings__control",
                "md-settings__radio-group",
                className
            )}
            orientation="horizontal"
            value={value}
            onChange={onChange}
            isDisabled={isGroupDisabled}
            // While a view is loading, block changes with readOnly rather than
            // disabled: disabling would make the focused radio unfocusable and
            // drop keyboard focus.
            isReadOnly={readOnly}
        >
            <DimensionLabel
                dimension={dimension}
                showChoiceDescriptions
                isDisabled={isGroupDisabled}
            />
            <DisabledReasonTooltip
                reason={isGroupDisabled ? DISABLED_CONTROL_REASON : undefined}
            >
                <div className="md-settings__radio-group-options">
                    {dimension.choices.map((choice) => {
                        const isChoiceUnavailable = !availableChoiceSlugs.has(
                            choice.slug
                        )
                        return (
                            <RadioField
                                key={choice.slug}
                                className="md-settings__radio-field"
                                value={choice.slug}
                                isDisabled={isChoiceUnavailable}
                            >
                                {/* In case the whole group is disabled, the group's own
                                    tooltip explains it instead. */}
                                <DisabledReasonTooltip
                                    reason={
                                        isChoiceUnavailable && !isGroupDisabled
                                            ? UNAVAILABLE_OPTION_REASON
                                            : undefined
                                    }
                                >
                                    <RadioButton
                                        className="md-settings__radio"
                                        data-track-note="multi-dim-choice-radio"
                                    >
                                        <span
                                            className="md-settings__radio-label"
                                            // The native tooltip would
                                            // compete with the reason one.
                                            title={
                                                isChoiceUnavailable
                                                    ? undefined
                                                    : choice.name
                                            }
                                        >
                                            {choice.name}
                                        </span>
                                    </RadioButton>
                                </DisabledReasonTooltip>
                            </RadioField>
                        )
                    })}
                </div>
            </DisabledReasonTooltip>
        </RadioGroup>
    )
}
