import { useMemo } from "react"

import { LabeledDropdown } from "../../../../components/LabeledDropdown/LabeledDropdown.js"
import type { BasicDropdownOption } from "../../../../components/LabeledDropdown/LabeledDropdown.js"

import { X_VARS } from "../core/constants.js"
import { INDEX_KEYS, IndexKey } from "../core/types.js"

/** The democracy index on the x axis: a grapher dropdown, each option with its one-line description */
export function IndexDropdown({
    value,
    onChange,
}: {
    value: IndexKey
    onChange: (key: IndexKey) => void
}): React.ReactElement {
    const options: BasicDropdownOption[] = useMemo(
        () =>
            INDEX_KEYS.map((key) => ({
                value: key,
                label: (
                    // The menu is portaled into the light DOM, out of reach of this bundle's
                    // stylesheet, so the second line is styled inline.
                    <span>
                        {X_VARS[key].label}
                        <span
                            style={{
                                display: "block",
                                color: "#767676",
                                fontSize: 12,
                                marginTop: 2,
                            }}
                        >
                            {X_VARS[key].optionDesc}
                        </span>
                    </span>
                ),
            })),
        []
    )
    return (
        <LabeledDropdown
            className="dd-index-dropdown"
            label="Measure of democracy (horizontal axis)"
            options={options}
            selectedValue={value}
            onChange={(v) => onChange(v as IndexKey)}
            isSearchable={false}
            renderTriggerValue={(option) =>
                option ? X_VARS[option.value as IndexKey].label : undefined
            }
            aria-label="Measure of democracy"
        />
    )
}
