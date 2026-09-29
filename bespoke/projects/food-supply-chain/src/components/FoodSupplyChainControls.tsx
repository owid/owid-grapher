import { useMemo } from "react"

import { BasicDropdownOption } from "@ourworldindata/grapher"

import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import { EntityDropdown } from "../../../../components/EntityDropdown/EntityDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

import { FoodSupplyChainMetadata, Measure } from "../core/types.js"

const MEASURE_ITEMS: SwitcherItem<Measure>[] = [
    { key: "energy", element: "Calories" },
    { key: "protein", element: "Protein" },
]

export function FoodSupplyChainControls({
    metadata,
    entityName,
    measure,
    year,
    years,
    setEntityName,
    setMeasure,
    setYear,
}: {
    metadata: FoodSupplyChainMetadata
    entityName: string
    measure: Measure
    year: number
    years: number[]
    setEntityName: (name: string) => void
    setMeasure: (measure: Measure) => void
    setYear: (year: number) => void
}): React.ReactElement {
    const availableEntities = useMemo<BasicDropdownOption[]>(
        () =>
            metadata.entities.map((entity) => ({
                value: entity.name,
                label: entity.name,
            })),
        [metadata.entities]
    )

    return (
        <Controls className="food-supply-chain-controls">
            <ControlsRow>
                <EntityDropdown
                    label="Country or region"
                    availableEntities={availableEntities}
                    selectedEntityName={entityName}
                    onChange={setEntityName}
                    isSearchable
                />
                <LabeledControl label="Measure">
                    <Switcher
                        items={MEASURE_ITEMS}
                        selectedKey={measure}
                        onChange={setMeasure}
                        ariaLabel="Measure"
                    />
                </LabeledControl>
                <TimeSlider
                    className="food-supply-chain-controls__time-slider"
                    times={years}
                    selectedTime={year}
                    onChange={setYear}
                />
            </ControlsRow>
        </Controls>
    )
}
