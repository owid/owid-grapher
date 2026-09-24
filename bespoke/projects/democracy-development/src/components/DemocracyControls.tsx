import { Checkbox } from "@ourworldindata/components"

import {
    Controls,
    ControlsRow,
} from "../../../../components/Controls/Controls.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

export function DemocracyControls({
    years,
    year,
    colorByRegion,
    sizeByPopulation,
    isPopulationLoading,
    setYear,
    setColorByRegion,
    setSizeByPopulation,
}: {
    years: number[]
    year: number
    colorByRegion: boolean
    sizeByPopulation: boolean
    isPopulationLoading: boolean
    setYear: (year: number) => void
    setColorByRegion: (value: boolean) => void
    setSizeByPopulation: (value: boolean) => void
}): React.ReactElement {
    // Grapher's native-input checkbox — don't swap for react-aria, whose
    // press handling drops clicks without pointer events (light trackpad taps)
    return (
        <Controls className="democracy-controls">
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
            </ControlsRow>
            <TimeSlider times={years} selectedTime={year} onChange={setYear} />
        </Controls>
    )
}
