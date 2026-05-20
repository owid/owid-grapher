import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"

import { EntityName } from "@ourworldindata/types"

import { Frame } from "../../../../components/Frame/Frame.js"
import {
    type BasicDropdownOption,
    InlineLabeledDropdown,
} from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"

import { EntityMetadata } from "../helpers/CausesOfDeathConstants.js"
import { CausesOfDeathMetadata } from "../helpers/CausesOfDeathMetadata.js"
import { CausesOfDeathTimeSlider } from "./CausesOfDeathTimeSlider.js"
import { useUserCountryInformation } from "../helpers/CausesOfDeathDataFetching.js"

export function CausesOfDeathControls({
    metadata,
    ageGroup,
    sex,
    entityName,
    year,
    setAgeGroup,
    setSex,
    setEntityName,
    setYear,
}: {
    metadata: CausesOfDeathMetadata
    ageGroup: string
    sex: string
    entityName: string
    year: number
    setAgeGroup: (ageGroup: string) => void
    setSex: (sex: string) => void
    setEntityName: (entityName: string) => void
    setYear: (year: number) => void
}): React.ReactElement {
    return (
        <Frame className="causes-of-death-controls">
            <h3 className="causes-of-death-controls__title">
                Configure the data
            </h3>
            <div className="causes-of-death-controls__content">
                <div className="causes-of-death-controls__row">
                    <AgeGroupDropdown
                        availableAgeGroups={metadata.availableAgeGroups}
                        selectedAgeGroup={ageGroup}
                        onChange={setAgeGroup}
                    />
                    <SexDropdown
                        availableSexes={metadata.availableSexes}
                        selectedSex={sex}
                        onChange={setSex}
                    />
                    <EntityDropdown
                        availableEntities={metadata?.availableEntities}
                        selectedEntityName={entityName}
                        onChange={setEntityName}
                    />
                </div>
                <div className="causes-of-death-controls__row">
                    <CausesOfDeathTimeSlider
                        className="causes-of-death-time-slider"
                        years={metadata.availableYears}
                        selectedYear={year}
                        onChange={setYear}
                    />
                </div>
            </div>
        </Frame>
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

    const options = useMemo(() => {
        const baseOptions =
            availableEntities?.map((entity) => ({
                value: entity.name,
                label: entity.name,
                id: entity.id,
            })) ?? []

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
    }, [availableEntities, userCountryInfo])

    return (
        <InlineLabeledDropdown
            label="Country/region"
            options={options}
            selectedValue={selectedEntityName}
            onChange={onChange}
            className={className}
            isLoading={isLoading}
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
    const options = useMemo(
        () =>
            availableAgeGroups?.map((ageGroup) => ({
                value: ageGroup,
                label: ageGroup,
                id: ageGroup,
            })) ?? [],
        [availableAgeGroups]
    )

    return (
        <InlineLabeledDropdown
            label="Age"
            options={options}
            selectedValue={selectedAgeGroup}
            onChange={onChange}
            className={className}
            isLoading={isLoading}
            placeholder="Select an age group..."
            aria-label="Select an age group"
            isSearchable={false}
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
        <div className="causes-of-death-controls__entity-dropdown-option">
            <span>{option.label}</span>
            {isUserCountry && (
                <FontAwesomeIcon icon={faLocationArrow} size="sm" />
            )}
        </div>
    )
}

function SexDropdown({
    availableSexes,
    selectedSex,
    onChange,
    className,
    isLoading,
}: {
    availableSexes: string[]
    selectedSex: string
    onChange: (sex: string) => void
    className?: string
    isLoading?: boolean
}) {
    const options = useMemo(
        () =>
            availableSexes?.map((sex) => ({
                value: sex,
                label: sex,
                id: sex,
            })) ?? [],
        [availableSexes]
    )

    return (
        <InlineLabeledDropdown
            label="Sex"
            options={options}
            selectedValue={selectedSex}
            onChange={onChange}
            className={className}
            isLoading={isLoading}
            placeholder="Select a sex..."
            aria-label="Select a sex"
            isSearchable={false}
        />
    )
}
