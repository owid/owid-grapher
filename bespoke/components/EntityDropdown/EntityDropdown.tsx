import { ComponentProps, useMemo } from "react"

import { BasicDropdownOption, Dropdown } from "@ourworldindata/grapher"
import { getRegionByCode, UserCountryInformation } from "@ourworldindata/utils"

import { useUserCountryInformation } from "../../hooks/useUserCountryInformation.js"
import { InlineLabeledDropdown } from "../InlineLabeledDropdown/InlineLabeledDropdown.js"

type GrapherDropdownProps = ComponentProps<typeof Dropdown<BasicDropdownOption>>
type DropdownCollection = GrapherDropdownProps["options"]

export interface EntityDropdownProps extends Omit<
    ComponentProps<typeof InlineLabeledDropdown>,
    "label" | "options" | "selectedValue"
> {
    label: string
    availableEntities: BasicDropdownOption[]
    selectedEntityName: string
}

export function EntityDropdown({
    label,
    availableEntities,
    selectedEntityName,
    ...dropdownProps
}: EntityDropdownProps): React.ReactElement {
    const { data: userCountryInfo } = useUserCountryInformation()

    const options = useMemo(
        () =>
            groupByUserLocation([...availableEntities], userCountryInfo, {
                selectedValue: selectedEntityName,
            }),
        [availableEntities, userCountryInfo, selectedEntityName]
    )

    return (
        <InlineLabeledDropdown
            {...dropdownProps}
            label={label}
            options={options}
            selectedValue={selectedEntityName}
            isSearchable={dropdownProps.isSearchable ?? true}
        />
    )
}

/** Prefix used for the synthetic id of a "Suggested" group entry. */
export const SUGGESTED_OPTION_ID_PREFIX = "suggested:"

export interface GroupByUserLocationOptions {
    /**
     * Values that should always appear at the top of the "Suggested" group,
     * in the given order (e.g. an "All countries" aggregate).
     */
    alwaysSuggested?: string[]
    /**
     * The currently selected value. When set (and present in the option
     * list) it is added to the "Suggested" group.
     */
    selectedValue?: string
}

/** Sortable string key for an option label. */
function labelSortKey(option: BasicDropdownOption): string {
    return typeof option.label === "string" ? option.label : option.value
}

/**
 * Splits a flat option list into a "Suggested" group (currently selected
 * entity + user's country + their continental regions, excluding income
 * groups) and an "All countries and regions" group.
 *
 * Within "Suggested", the `alwaysSuggested` values are pinned first (in the
 * given order), and the remaining suggestions are sorted alphabetically.
 *
 * The "All countries and regions" group contains every option, including
 * the ones surfaced in "Suggested". To keep react-aria collection ids
 * unique across both groups, the "Suggested" entries are given a synthetic
 * `id` (the plain `value` stays on the "All" copies). Renderers key off
 * `option.id ?? option.value`.
 */
export function groupByUserLocation(
    options: BasicDropdownOption[],
    userCountryInfo: UserCountryInformation | undefined,
    { alwaysSuggested = [], selectedValue }: GroupByUserLocationOptions = {}
): DropdownCollection {
    const optionsByValue = new Map(
        options.map((option) => [option.value, option])
    )

    // Pinned suggestions keep their given order; the rest are sorted
    // alphabetically below.
    const pinned: BasicDropdownOption[] = []
    const rest: BasicDropdownOption[] = []
    const suggestedValues = new Set<string>()
    const addToSuggestions = (
        bucket: BasicDropdownOption[],
        option: BasicDropdownOption | undefined
    ) => {
        if (!option || suggestedValues.has(option.value)) return
        suggestedValues.add(option.value)
        // Give the suggested copy a distinct id so the same value can also
        // appear in the "All countries and regions" group below.
        bucket.push({
            ...option,
            id: `${SUGGESTED_OPTION_ID_PREFIX}${option.value}`,
        })
    }

    for (const value of alwaysSuggested) {
        addToSuggestions(pinned, optionsByValue.get(value))
    }
    if (selectedValue !== undefined) {
        addToSuggestions(rest, optionsByValue.get(selectedValue))
    }
    if (userCountryInfo) {
        addToSuggestions(rest, optionsByValue.get(userCountryInfo.name))
        if (userCountryInfo.regions) {
            for (const code of userCountryInfo.regions) {
                const region = getRegionByCode(code)

                // Ignore income groups
                if (!region || region.regionType === "income_group") continue

                addToSuggestions(rest, optionsByValue.get(region.name))
            }
        }
    }
    rest.sort((a, b) => labelSortKey(a).localeCompare(labelSortKey(b)))

    const suggested = [...pinned, ...rest]
    if (suggested.length === 0) return options

    return [
        { label: "Suggested", options: suggested },
        { label: "All countries and regions", options },
    ]
}
