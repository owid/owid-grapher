import { Time } from "@ourworldindata/types"

import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

export interface ConflictDeathsTimeSliderProps {
    years: Time[]
    selectedYear: Time
    onChange: (year: Time) => void
    className?: string
}

export function ConflictDeathsTimeSlider({
    years,
    selectedYear,
    onChange,
    className,
}: ConflictDeathsTimeSliderProps) {
    return (
        <TimeSlider
            times={years}
            selectedTime={selectedYear}
            onChange={onChange}
            className={className}
        />
    )
}
