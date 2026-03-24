import { useCallback, useMemo } from "react"

import { EntityName } from "@ourworldindata/types"
import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
    DropdownCollection,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"
import { getRegionByCode } from "@ourworldindata/utils"

import { DemographyMetadata } from "../helpers/types.js"
import { useUserCountryInformation } from "../helpers/fetch.js"

import { Frame } from "../../../../components/Frame/Frame.js"

export function DemographyControls({
    metadata,
    entityName,
    setEntityName,
}: {
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (entityName: string) => void
}): React.ReactElement {
    return (
        <Frame className="demography-controls">
            <h3 className="demography-controls__title">
                Select a country or region
            </h3>
            <EntityDropdown
                availableCountries={metadata.countries}
                selectedEntityName={entityName}
                onChange={setEntityName}
            />
        </Frame>
    )
}

function Dropdown({
    options,
    selectedValue,
    onChange,
    fallbackValue,
    ...dropdownProps
}: {
    options: DropdownCollection<BasicDropdownOption>
    selectedValue: string
    onChange: (value: string) => void
    fallbackValue?: string
} & Omit<
    React.ComponentProps<typeof GrapherDropdown>,
    "options" | "value" | "onChange"
>) {
    const allOptions = useMemo(
        () =>
            options.flatMap((item) =>
                "options" in item ? item.options : [item]
            ),
        [options]
    )

    const selectedOption =
        allOptions.find((option) => option.value === selectedValue) || null

    const handleChange = useCallback(
        (option: BasicDropdownOption | null) => {
            const newValue = option?.value ?? fallbackValue
            if (newValue) {
                onChange(newValue)
            }
        },
        [onChange, fallbackValue]
    )

    return (
        <GrapherDropdown
            {...dropdownProps}
            options={options}
            value={selectedOption}
            onChange={handleChange}
            isClearable={false}
        />
    )
}

function EntityDropdown({
    availableCountries,
    selectedEntityName,
    onChange,
}: {
    availableCountries: string[]
    selectedEntityName: EntityName
    onChange: (entityName: EntityName) => void
}) {
    const { data: userCountryInfo } = useUserCountryInformation()

    const options: DropdownCollection<BasicDropdownOption> = useMemo(() => {
        const makeOption = (name: string) => ({
            value: name,
            label: name,
            id: name,
        })

        if (!userCountryInfo) return availableCountries.map(makeOption)

        const availableSet = new Set(availableCountries)

        // Collect suggested names: user's country + regions they belong to
        const suggestedNames: string[] = []
        if (availableSet.has(userCountryInfo.name)) {
            suggestedNames.push(userCountryInfo.name)
        }
        if (userCountryInfo.regions) {
            for (const code of userCountryInfo.regions) {
                const region = getRegionByCode(code)
                if (
                    region &&
                    region.regionType !== "income_group" &&
                    availableSet.has(region.name)
                ) {
                    suggestedNames.push(region.name)
                }
            }
        }

        if (suggestedNames.length === 0) {
            return availableCountries.map(makeOption)
        }

        const suggestedSet = new Set(suggestedNames)
        const remaining = availableCountries.filter(
            (name) => !suggestedSet.has(name)
        )

        return [
            {
                label: "Suggested",
                options: suggestedNames.map(makeOption),
            },
            {
                label: "All countries and regions",
                options: remaining.map(makeOption),
            },
        ]
    }, [availableCountries, userCountryInfo])

    return (
        <Dropdown
            className="demography-country-selector"
            options={options}
            selectedValue={selectedEntityName}
            onChange={onChange}
            placeholder="Select a country or region..."
            isSearchable={true}
            aria-label="Select a country or region"
        />
    )
}
