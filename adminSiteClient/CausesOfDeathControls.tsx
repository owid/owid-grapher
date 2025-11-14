import { useCallback } from "react"

import { EntityName } from "@ourworldindata/types"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher"
import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"

import { EntityMetadata } from "./CausesOfDeathConstants.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathTimeSlider } from "./CausesOfDeathTimeSlider.js"

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
    const options =
        availableEntities?.map((entity) => ({
            value: entity.name,
            label: entity.name,
            id: entity.id,
        })) ?? []

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
