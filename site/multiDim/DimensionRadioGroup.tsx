import cx from "clsx"
import { RadioButton, RadioField, RadioGroup } from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"
import DimensionLabel from "./DimensionLabel.js"

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
            isDisabled={dimension.choices.length === 1}
            // While a view is loading, block changes with readOnly rather than
            // disabled: disabling would make the focused radio unfocusable and
            // drop keyboard focus.
            isReadOnly={readOnly}
        >
            <DimensionLabel
                name={dimension.name}
                description={dimension.description}
            />
            <div className="md-settings__radio-group-options">
                {dimension.choices.map((choice) => (
                    <RadioField
                        key={choice.slug}
                        className="md-settings__radio-field"
                        value={choice.slug}
                        isDisabled={!availableChoiceSlugs.has(choice.slug)}
                    >
                        <RadioButton
                            className="md-settings__radio"
                            data-track-note="multi-dim-choice-radio"
                        >
                            <span
                                className="md-settings__radio-label"
                                title={choice.name}
                            >
                                {choice.name}
                            </span>
                        </RadioButton>
                    </RadioField>
                ))}
            </div>
        </RadioGroup>
    )
}
