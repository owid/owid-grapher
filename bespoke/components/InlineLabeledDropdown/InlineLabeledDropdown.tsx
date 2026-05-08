import { ComponentProps, useCallback, useMemo } from "react"
import { BasicDropdownOption, Dropdown } from "@ourworldindata/grapher"

type GrapherDropdownProps = ComponentProps<typeof Dropdown<BasicDropdownOption>>
type DropdownCollection = GrapherDropdownProps["options"]

export interface InlineLabeledDropdownProps extends Omit<
    GrapherDropdownProps,
    "value" | "onChange" | "isClearable" | "renderTriggerValue"
> {
    options: DropdownCollection
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
    const selectedOption = useMemo(
        () => findOptionByValue(options, selectedValue),
        [options, selectedValue]
    )

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

/** Find an option by value across both flat and grouped collections */
function findOptionByValue(
    collection: DropdownCollection,
    value: string
): BasicDropdownOption | null {
    for (const item of collection) {
        if ("options" in item) {
            const found = item.options.find((o) => o.value === value)
            if (found) return found
        } else if (item.value === value) {
            return item
        }
    }
    return null
}

export type { BasicDropdownOption, DropdownCollection }
