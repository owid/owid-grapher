import { useCallback, useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"

import { EntityName } from "@ourworldindata/types"
import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"

import { DemographyMetadata } from "./DemographyTypes.js"
import { useUserCountryInformation } from "./DemographyDataFetching.js"

import { ChartControls } from "../bespoke/components/ChartControls/ChartControls"

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
        <ChartControls
            className="demography-controls"
            title="Select a country or region"
        >
            <EntityDropdown
                availableCountries={metadata.countries}
                selectedEntityName={entityName}
                onChange={setEntityName}
            />
        </ChartControls>
    )
}

function Dropdown({
    options,
    selectedValue,
    onChange,
    fallbackValue,
    ...dropdownProps
}: {
    options: BasicDropdownOption[]
    selectedValue: string
    onChange: (value: string) => void
    fallbackValue?: string
} & Omit<
    React.ComponentProps<typeof GrapherDropdown>,
    "options" | "value" | "onChange"
>) {
    const selectedOption =
        options.find((option) => option.value === selectedValue) || null

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

    const options = useMemo(() => {
        const baseOptions = availableCountries.map((name) => ({
            value: name,
            label: name,
            id: name,
        }))

        // Move user's country to the top of the list if it's available
        if (!userCountryInfo) return baseOptions

        const userCountryOptionIndex = baseOptions.findIndex(
            (option) => option.label === userCountryInfo.name
        )
        if (userCountryOptionIndex > -1) {
            const [userCountryOption] = baseOptions.splice(
                userCountryOptionIndex,
                1
            )
            baseOptions.unshift(userCountryOption)
        }

        return baseOptions
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
            renderMenuOption={(option) => (
                <EntityDropdownOption
                    option={option}
                    isUserCountry={option?.label === userCountryInfo?.name}
                />
            )}
        />
    )
}

function EntityDropdownOption({
    option,
    isUserCountry,
}: {
    option: BasicDropdownOption | null
    isUserCountry?: boolean
}): React.ReactElement | null {
    if (!option) return null
    return (
        <div className="demography-controls__entity-dropdown-option">
            <span>{option.label}</span>
            {isUserCountry && (
                <FontAwesomeIcon icon={faLocationArrow} size="sm" />
            )}
        </div>
    )
}
