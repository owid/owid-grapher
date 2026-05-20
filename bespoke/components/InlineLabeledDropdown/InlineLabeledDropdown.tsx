import { ComponentProps, useCallback } from "react"
import { BasicDropdownOption, Dropdown } from "@ourworldindata/grapher"

type GrapherDropdownProps = ComponentProps<typeof Dropdown<BasicDropdownOption>>

export interface InlineLabeledDropdownProps extends Omit<
    GrapherDropdownProps,
    "value" | "onChange" | "isClearable" | "renderTriggerValue"
> {
    options: BasicDropdownOption[]
    label: string
    selectedValue: string
    onChange: (value: string) => void
}

export function InlineLabeledDropdown({
    label,
    options,
    selectedValue,
    onChange,
    ...dropdownProps
}: InlineLabeledDropdownProps): React.ReactElement {
    const selectedOption =
        options.find((option) => option.value === selectedValue) ?? null

    const handleChange = useCallback(
        (option: BasicDropdownOption | null) => {
            const value = option?.value
            if (value !== undefined) onChange(value)
        },
        [onChange]
    )

    return (
        <Dropdown
            {...dropdownProps}
            options={options}
            value={selectedOption}
            onChange={handleChange}
            isClearable={false}
            renderTriggerValue={(option) =>
                option ? (
                    <>
                        <span className="label">{label}: </span>
                        {option.label}
                    </>
                ) : null
            }
        />
    )
}

export type { BasicDropdownOption }
