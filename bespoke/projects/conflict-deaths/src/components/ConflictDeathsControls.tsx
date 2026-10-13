import { useMemo } from "react"

import {
    Controls,
    ControlsRow,
} from "../../../../components/Controls/Controls.js"
import { LabeledDropdown } from "../../../../components/LabeledDropdown/LabeledDropdown.js"

import { ConflictDeathsMetadata } from "../core/ConflictDeathsMetadata.js"
import { ConflictDeathsTimeSlider } from "./ConflictDeathsTimeSlider.js"

export function ConflictDeathsControls({
    metadata,
    conflictTypeSlug,
    year,
    setConflictTypeSlug,
    setYear,
}: {
    metadata: ConflictDeathsMetadata
    conflictTypeSlug: string
    year: number
    setConflictTypeSlug: (slug: string) => void
    setYear: (year: number) => void
}): React.ReactElement {
    const conflictTypeOptions = useMemo(
        () =>
            metadata.conflictTypes.map((type) => ({
                value: type.slug,
                label: type.name,
            })),
        [metadata.conflictTypes]
    )

    return (
        <Controls className="conflict-deaths-controls">
            <ControlsRow>
                <LabeledDropdown
                    label="Conflict type"
                    options={conflictTypeOptions}
                    selectedValue={conflictTypeSlug}
                    onChange={setConflictTypeSlug}
                    placeholder="Select a conflict type..."
                    aria-label="Select a conflict type"
                    isSearchable={false}
                />
            </ControlsRow>
            <ControlsRow>
                <ConflictDeathsTimeSlider
                    className="conflict-deaths-time-slider"
                    years={metadata.availableYears}
                    selectedYear={year}
                    onChange={setYear}
                />
            </ControlsRow>
        </Controls>
    )
}
