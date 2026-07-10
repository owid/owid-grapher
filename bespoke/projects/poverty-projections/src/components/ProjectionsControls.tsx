import { useCallback, useMemo } from "react"

import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"

import { Frame } from "../../../../components/Frame/Frame.js"

import {
    ALL_SCENARIOS,
    BASELINE_LABEL,
    BASELINE_SCENARIO,
    POVERTY_LINES,
    SCENARIOS,
    ScenarioSelection,
    VariantName,
} from "../helpers/PovertyProjectionsConstants.js"

export function ProjectionsControls({
    variant,
    povertyLineCents,
    scenario,
    setPovertyLineCents,
    setScenario,
}: {
    variant: VariantName
    povertyLineCents: number
    scenario: ScenarioSelection
    setPovertyLineCents: (povertyLineCents: number) => void
    setScenario: (scenario: ScenarioSelection) => void
}): React.ReactElement {
    return (
        <Frame className="poverty-projections-controls">
            <h3 className="poverty-projections-controls__title">
                Configure the data
            </h3>
            <div className="poverty-projections-controls__row">
                <PovertyLineDropdown
                    selectedPovertyLineCents={povertyLineCents}
                    onChange={setPovertyLineCents}
                />
                <ScenarioDropdown
                    variant={variant}
                    selectedScenario={scenario}
                    onChange={setScenario}
                />
            </div>
        </Frame>
    )
}

function Dropdown({
    options,
    selectedValue,
    onChange,
    ...dropdownProps
}: {
    options: BasicDropdownOption[]
    selectedValue: string
    onChange: (value: string) => void
} & Omit<
    React.ComponentProps<typeof GrapherDropdown>,
    "options" | "value" | "onChange"
>) {
    const selectedOption =
        options.find((option) => option.value === selectedValue) || null

    const handleChange = useCallback(
        (option: BasicDropdownOption | null) => {
            if (option?.value) onChange(option.value)
        },
        [onChange]
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

function PovertyLineDropdown({
    selectedPovertyLineCents,
    onChange,
}: {
    selectedPovertyLineCents: number
    onChange: (povertyLineCents: number) => void
}) {
    const options = useMemo(
        () =>
            POVERTY_LINES.map((line) => ({
                value: line.cents.toString(),
                label: line.label,
                id: line.cents,
            })),
        []
    )

    const handleChange = useCallback(
        (value: string) => onChange(parseInt(value, 10)),
        [onChange]
    )

    return (
        <Dropdown
            options={options}
            selectedValue={selectedPovertyLineCents.toString()}
            onChange={handleChange}
            placeholder="Select a poverty line..."
            aria-label="Select a poverty line"
            isSearchable={false}
            renderTriggerValue={(option) => (
                <DropdownTriggerLabel label="Poverty line: " option={option} />
            )}
        />
    )
}

export const getScenarioOptions = (
    variant: VariantName
): { value: ScenarioSelection; label: string }[] => [
    { value: BASELINE_SCENARIO, label: BASELINE_LABEL },
    ...SCENARIOS.map((scenario) => ({
        value: scenario.id,
        label: scenario.label,
    })),
    // A fan of scenario lines is only legible for a single entity, so the
    // all-scenarios view shows the World only — and makes no sense for the
    // stacked chart
    ...(variant === "share"
        ? [
              {
                  value: ALL_SCENARIOS as ScenarioSelection,
                  label: "All scenarios (World)",
              },
          ]
        : []),
]

function ScenarioDropdown({
    variant,
    selectedScenario,
    onChange,
}: {
    variant: VariantName
    selectedScenario: ScenarioSelection
    onChange: (scenario: ScenarioSelection) => void
}) {
    const options = useMemo(
        () =>
            getScenarioOptions(variant).map((option) => ({
                value: option.value,
                label: option.label,
                id: option.value,
            })),
        [variant]
    )

    const handleChange = useCallback(
        (value: string) => {
            const option = getScenarioOptions(variant).find(
                (o) => o.value === value
            )
            if (option) onChange(option.value)
        },
        [onChange, variant]
    )

    return (
        <Dropdown
            options={options}
            selectedValue={selectedScenario}
            onChange={handleChange}
            placeholder="Select a scenario..."
            aria-label="Select a projection scenario"
            isSearchable={false}
            renderTriggerValue={(option) => (
                <DropdownTriggerLabel label="Scenario: " option={option} />
            )}
        />
    )
}

function DropdownTriggerLabel({
    label,
    option,
}: {
    label: string
    option: BasicDropdownOption | null
}): React.ReactElement | null {
    if (!option) return null
    return (
        <>
            <span className="label">{label}</span>
            {option.label}
        </>
    )
}
