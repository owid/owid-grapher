import { useCallback } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"

import { EntityName } from "@ourworldindata/types"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher"
import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"

import { EntityMetadata } from "./CausesOfDeathConstants.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathTimeSlider } from "./CausesOfDeathTimeSlider.js"
import { useUserCountryInformation } from "./CausesOfDeathDataFetching.js"

export function CausesOfDeathControls({
    metadata,
    ageGroup,
    entityName,
    year,
    setAgeGroup,
    setEntityName,
    setYear,
}: {
    metadata: CausesOfDeathMetadata
    ageGroup: string
    entityName: string
    year: number
    setAgeGroup: (ageGroup: string) => void
    setEntityName: (entityName: string) => void
    setYear: (year: number) => void
}): React.ReactElement {
    return (
        <div className="causes-of-death-controls">
            <div className="causes-of-death-controls__title">
                Configure the data
            </div>
            <div className="causes-of-death-controls__content">
                <AgeGroupDropdown
                    availableAgeGroups={metadata.availableAgeGroups}
                    selectedAgeGroup={ageGroup}
                    onChange={setAgeGroup}
                />
                <EntityDropdown
                    availableEntities={metadata?.availableEntities}
                    selectedEntityName={entityName}
                    onChange={setEntityName}
                />
                <CausesOfDeathTimeSlider
                    years={metadata.availableYears}
                    selectedYear={year}
                    onChange={setYear}
                />
            </div>
        </div>
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
    availableEntities,
    selectedEntityName,
    onChange,
    className,
    isLoading,
}: {
    availableEntities: EntityMetadata[]
    selectedEntityName: EntityName
    onChange: (entityName: EntityName) => void
    className?: string
    isLoading?: boolean
}) {
    const { data: userCountryInfo } = useUserCountryInformation()

    const options =
        availableEntities?.map((entity) => ({
            value: entity.name,
            label: entity.name,
            id: entity.id,
        })) ?? []

    // Move user's country to the top of the list if it's available
    const userCountryOptionIndex = options.findIndex(
        (option) => option.label === userCountryInfo?.name
    )
    if (userCountryInfo && userCountryOptionIndex > -1) {
        const [userCountryOption] = options.splice(userCountryOptionIndex, 1)
        options.unshift(userCountryOption)
    }

    return (
        <Dropdown
            options={options}
            selectedValue={selectedEntityName}
            onChange={onChange}
            className={className}
            isLoading={isLoading}
            placeholder="Select a region..."
            isSearchable={true}
            aria-label="Select a region"
            renderTriggerValue={(option) => (
                <EntityDropdownLabel option={option} />
            )}
            renderMenuOption={(option) => (
                <EntityDropdownOption
                    option={option}
                    isUserCountry={option?.label === userCountryInfo?.name}
                />
            )}
            fallbackValue={WORLD_ENTITY_NAME}
        />
    )
}

function AgeGroupDropdown({
    availableAgeGroups,
    selectedAgeGroup,
    onChange,
    className,
    isLoading,
}: {
    availableAgeGroups: string[]
    selectedAgeGroup: string
    onChange: (ageGroup: string) => void
    className?: string
    isLoading?: boolean
}) {
    const options =
        availableAgeGroups?.map((ageGroup) => ({
            value: ageGroup,
            label: ageGroup,
            id: ageGroup,
        })) ?? []

    return (
        <Dropdown
            options={options}
            selectedValue={selectedAgeGroup}
            onChange={onChange}
            className={className}
            isLoading={isLoading}
            placeholder="Select an age group..."
            aria-label="Select an age group"
            isSearchable={false}
            renderTriggerValue={(option) => (
                <AgeGroupDropdownLabel option={option} />
            )}
        />
    )
}

function EntityDropdownLabel({
    option,
}: {
    option: BasicDropdownOption | null
}): React.ReactElement | null {
    if (!option) return null
    return (
        <>
            <span className="label">Region: </span>
            {option.label}
        </>
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
        <div className="causes-of-death-controls__entity-dropdown-option">
            <span>{option.label}</span>
            {isUserCountry && (
                <FontAwesomeIcon icon={faLocationArrow} size="sm" />
            )}
        </div>
    )
}

function AgeGroupDropdownLabel({
    option,
}: {
    option: BasicDropdownOption | null
}): React.ReactElement | null {
    if (!option) return null
    return (
        <>
            <span className="label">Age: </span>
            {option.label}
        </>
    )
}
