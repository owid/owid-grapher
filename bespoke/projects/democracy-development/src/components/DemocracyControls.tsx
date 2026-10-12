import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPause, faPlay } from "@fortawesome/free-solid-svg-icons"

import { Checkbox } from "@ourworldindata/components"
import type { EntityName } from "@ourworldindata/types"

import {
    Controls,
    ControlsRow,
} from "../../../../components/Controls/Controls.js"
import {
    LabeledDropdown,
    type BasicDropdownOption,
} from "../../../../components/LabeledDropdown/LabeledDropdown.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

/** The dropdown value standing for "no country highlighted" */
export const NO_COUNTRY = ""

export function DemocracyControls({
    years,
    year,
    countries,
    selectedCountry,
    colorByRegion,
    sizeByPopulation,
    fixedAxes,
    isPlaying,
    isPopulationLoading,
    setYear,
    setSelectedCountry,
    setColorByRegion,
    setSizeByPopulation,
    setFixedAxes,
    togglePlaying,
}: {
    years: number[]
    year: number
    countries: EntityName[]
    selectedCountry: EntityName
    colorByRegion: boolean
    sizeByPopulation: boolean
    fixedAxes: boolean
    isPlaying: boolean
    isPopulationLoading: boolean
    setYear: (year: number) => void
    setSelectedCountry: (name: EntityName) => void
    setColorByRegion: (value: boolean) => void
    setSizeByPopulation: (value: boolean) => void
    setFixedAxes: (value: boolean) => void
    togglePlaying: () => void
}): React.ReactElement {
    const countryOptions = useMemo<BasicDropdownOption[]>(
        () => [
            { value: NO_COUNTRY, label: "None" },
            ...[...countries]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => ({ value: name, label: name })),
        ],
        [countries]
    )

    // Grapher's native-input checkbox — don't swap for react-aria, whose
    // press handling drops clicks without pointer events (light trackpad taps)
    return (
        <Controls className="democracy-controls">
            <ControlsRow>
                <LabeledDropdown
                    className="democracy-controls__country"
                    label="Highlight a country"
                    options={countryOptions}
                    selectedValue={selectedCountry}
                    onChange={setSelectedCountry}
                    placeholder="Search for a country…"
                    aria-label="Highlight a country"
                    isSearchable
                />
            </ControlsRow>
            <ControlsRow>
                <Checkbox
                    className="democracy-controls__checkbox"
                    checked={colorByRegion}
                    onChange={(e) => setColorByRegion(e.target.checked)}
                    label="Color by world region"
                />
                <Checkbox
                    className="democracy-controls__checkbox"
                    checked={sizeByPopulation}
                    onChange={(e) => setSizeByPopulation(e.target.checked)}
                    label={
                        isPopulationLoading
                            ? "Size by population (loading…)"
                            : "Size by population"
                    }
                />
                <Checkbox
                    className="democracy-controls__checkbox"
                    checked={fixedAxes}
                    onChange={(e) => setFixedAxes(e.target.checked)}
                    label="Fix axis ranges across years"
                />
            </ControlsRow>
            <div className="democracy-controls__timeline">
                <button
                    type="button"
                    className="democracy-controls__play"
                    onClick={togglePlaying}
                    aria-label={isPlaying ? "Pause" : "Play through the years"}
                    title={isPlaying ? "Pause" : "Play"}
                >
                    <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>
                <TimeSlider
                    times={years}
                    selectedTime={year}
                    onChange={setYear}
                />
            </div>
        </Controls>
    )
}
