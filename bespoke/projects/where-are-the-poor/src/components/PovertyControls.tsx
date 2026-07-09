import { useCallback, useMemo } from "react"

import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"

import { Frame } from "../../../../components/Frame/Frame.js"

import {
    formatGroupLabel,
    getRegionSelectionOptions,
    GROUP_BY_OPTIONS,
    GroupBy,
    POVERTY_LINES,
    WORLD_SELECTION,
} from "../helpers/PovertyConstants.js"
import { PovertyTimeSlider } from "./PovertyTimeSlider.js"

export function PovertyControls({
    povertyLineCents,
    groupBy,
    region,
    years,
    year,
    setPovertyLineCents,
    setGroupBy,
    setRegion,
    setYear,
}: {
    povertyLineCents: number
    groupBy: GroupBy
    region: string
    years: number[]
    year: number
    setPovertyLineCents: (povertyLineCents: number) => void
    setGroupBy: (groupBy: GroupBy) => void
    setRegion: (region: string) => void
    setYear: (year: number) => void
}): React.ReactElement {
    return (
        <Frame className="where-are-the-poor-controls">
            <h3 className="where-are-the-poor-controls__title">
                Configure the data
            </h3>
            <div className="where-are-the-poor-controls__content">
                <div className="where-are-the-poor-controls__row">
                    <PovertyLineDropdown
                        selectedPovertyLineCents={povertyLineCents}
                        onChange={setPovertyLineCents}
                    />
                    <RegionDropdown
                        groupBy={groupBy}
                        selectedRegion={region}
                        onChange={setRegion}
                    />
                    <GroupByDropdown
                        selectedGroupBy={groupBy}
                        onChange={setGroupBy}
                    />
                </div>
                <div className="where-are-the-poor-controls__row">
                    <PovertyTimeSlider
                        className="where-are-the-poor-time-slider"
                        years={years}
                        selectedYear={year}
                        onChange={setYear}
                    />
                </div>
            </div>
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

function PovertyLineDropdown({
    selectedPovertyLineCents,
    onChange,
    className,
}: {
    selectedPovertyLineCents: number
    onChange: (povertyLineCents: number) => void
    className?: string
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
            className={className}
            placeholder="Select a poverty line..."
            aria-label="Select a poverty line"
            isSearchable={false}
            renderTriggerValue={(option) => (
                <DropdownTriggerLabel label="Poverty line: " option={option} />
            )}
        />
    )
}

function RegionDropdown({
    groupBy,
    selectedRegion,
    onChange,
    className,
}: {
    groupBy: GroupBy
    selectedRegion: string
    onChange: (region: string) => void
    className?: string
}) {
    // Offer the regions of the active grouping: continents when grouping by
    // continent, World Bank regions when grouping by World Bank region
    const options = useMemo(
        () =>
            getRegionSelectionOptions(groupBy).map((region) => ({
                value: region,
                label: formatGroupLabel(region),
                id: region,
            })),
        [groupBy]
    )

    const triggerLabel = groupBy === "continent" ? "Continent: " : "Region: "

    return (
        <Dropdown
            options={options}
            selectedValue={selectedRegion}
            onChange={onChange}
            className={className}
            placeholder="Select a region..."
            aria-label="Select a region"
            isSearchable={false}
            fallbackValue={WORLD_SELECTION}
            renderTriggerValue={(option) => (
                <DropdownTriggerLabel label={triggerLabel} option={option} />
            )}
        />
    )
}

function GroupByDropdown({
    selectedGroupBy,
    onChange,
    className,
}: {
    selectedGroupBy: GroupBy
    onChange: (groupBy: GroupBy) => void
    className?: string
}) {
    const options = useMemo(
        () =>
            GROUP_BY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                id: option.value,
            })),
        []
    )

    const handleChange = useCallback(
        (value: string) => {
            const groupByOption = GROUP_BY_OPTIONS.find(
                (option) => option.value === value
            )
            if (groupByOption) onChange(groupByOption.value)
        },
        [onChange]
    )

    return (
        <Dropdown
            options={options}
            selectedValue={selectedGroupBy}
            onChange={handleChange}
            className={className}
            placeholder="Select a grouping..."
            aria-label="Select a grouping"
            isSearchable={false}
            renderTriggerValue={(option) => (
                <DropdownTriggerLabel label="Group by: " option={option} />
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
