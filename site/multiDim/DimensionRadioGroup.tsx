import cx from "clsx"
import { Label, Radio, RadioGroup } from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"

export default function DimensionRadioGroup({
    className,
    dimension,
    availableChoiceSlugs,
    value,
    onChange,
    disabled,
}: {
    className?: string
    dimension: DimensionEnriched
    availableChoiceSlugs: Set<string>
    value: string
    onChange: (value: string) => void
    disabled?: boolean
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
            isDisabled={disabled || dimension.choices.length === 1}
        >
            <Label className="md-settings__radio-group-label">
                {dimension.name}
            </Label>
            {dimension.choices.map((choice) => (
                <Radio
                    key={choice.slug}
                    className="md-settings__radio"
                    value={choice.slug}
                    isDisabled={!availableChoiceSlugs.has(choice.slug)}
                    data-track-note="multi-dim-choice-radio"
                >
                    <span
                        className="md-settings__radio-label"
                        title={choice.name}
                    >
                        {choice.name}
                    </span>
                </Radio>
            ))}
        </RadioGroup>
    )
}
