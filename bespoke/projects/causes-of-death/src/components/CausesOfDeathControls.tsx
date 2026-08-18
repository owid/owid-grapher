import { useMemo } from "react"

import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import { LabeledDropdown } from "../../../../components/LabeledDropdown/LabeledDropdown.js"
import { EntityDropdown } from "../../../../components/EntityDropdown/EntityDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

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
        <Controls className="causes-of-death-controls">
            <ControlsRow>
                <AgeGroupDropdown
                    availableAgeGroups={metadata.availableAgeGroups}
                    selectedAgeGroup={ageGroup}
                    onChange={setAgeGroup}
                />
                <SexSwitcher
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
            </ControlsRow>
            <ControlsRow>
                <CausesOfDeathTimeSlider
                    className="causes-of-death-time-slider"
                    years={metadata.availableYears}
                    selectedYear={year}
                    onChange={setYear}
                />
            </ControlsRow>
        </Controls>
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
        <LabeledDropdown
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

function SexSwitcher({
    availableSexes,
    selectedSex,
    onChange,
}: {
    availableSexes: string[]
    selectedSex: string
    onChange: (sex: string) => void
}) {
    const items = useMemo<SwitcherItem[]>(
        () =>
            availableSexes.map((sex) => ({
                key: sex,
                element: sex === "Both sexes" ? "Both" : sex,
            })),
        [availableSexes]
    )

    return (
        <LabeledControl label="Sex">
            <Switcher
                items={items}
                selectedKey={selectedSex}
                onChange={onChange}
                ariaLabel="Select a sex"
            />
        </LabeledControl>
    )
}
