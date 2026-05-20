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
        () => groupByUserLocation([...availableEntities], userCountryInfo),
        [availableEntities, userCountryInfo]
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

/**
 * Splits a flat option list into a "Suggested" group (user's country +
 * their continental regions, excluding income groups) and an "All
 * countries and regions" group
 */
export function groupByUserLocation(
    options: BasicDropdownOption[],
    userCountryInfo: UserCountryInformation | undefined,
    alwaysSuggested: string[] = []
): DropdownCollection {
    const optionsByValue = new Map(
        options.map((option) => [option.value, option])
    )

    const suggested: BasicDropdownOption[] = []
    const addToSuggestions = (option: BasicDropdownOption | undefined) => {
        if (option && !suggested.includes(option)) suggested.push(option)
    }

    for (const value of alwaysSuggested) {
        addToSuggestions(optionsByValue.get(value))
    }
    if (userCountryInfo) {
        addToSuggestions(optionsByValue.get(userCountryInfo.name))
        if (userCountryInfo.regions) {
            for (const code of userCountryInfo.regions) {
                const region = getRegionByCode(code)

                // Ignore income groups
                if (!region || region.regionType === "income_group") continue

                addToSuggestions(optionsByValue.get(region.name))
            }
        }
    }
    if (suggested.length === 0) return options

    const suggestedSet = new Set(suggested.map((option) => option.value))
    const rest = options.filter((option) => !suggestedSet.has(option.value))

    return [
        { label: "Suggested", options: suggested },
        { label: "All countries and regions", options: rest },
    ]
}
