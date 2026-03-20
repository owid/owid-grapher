import { Time } from "@ourworldindata/types"

import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

export interface CausesOfDeathTimeSliderProps {
    years: Time[]
    selectedYear: Time
    onChange: (year: Time) => void
    className?: string
}

export function CausesOfDeathTimeSlider({
    years,
    selectedYear,
    onChange,
    className,
}: CausesOfDeathTimeSliderProps) {
    return (
        <TimeSlider
            times={years}
            selectedTime={selectedYear}
            onChange={onChange}
            className={className}
        />
    )
}
