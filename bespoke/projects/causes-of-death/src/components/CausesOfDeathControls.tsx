import { useMemo } from "react"

import { Frame } from "../../../../components/Frame/Frame.js"
import { InlineLabeledDropdown } from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"
import { EntityDropdown } from "../../../../components/EntityDropdown/EntityDropdown.js"

import { CausesOfDeathMetadata } from "../helpers/CausesOfDeathMetadata.js"
import { CausesOfDeathTimeSlider } from "./CausesOfDeathTimeSlider.js"

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
    const entityOptions = useMemo(
        () =>
            metadata.availableEntities.map((entity) => ({
                value: entity.name,
                label: entity.name,
            })),
        [metadata.availableEntities]
    )

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
                        label="Country/region"
                        availableEntities={entityOptions}
                        selectedEntityName={entityName}
                        onChange={setEntityName}
                        placeholder="Select a country or region..."
                        aria-label="Select a country or region"
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
