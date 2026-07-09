import { Time } from "@ourworldindata/types"

import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

export interface PovertyTimeSliderProps {
    years: Time[]
    selectedYear: Time
    onChange: (year: Time) => void
    className?: string
}

export function PovertyTimeSlider({
    years,
    selectedYear,
    onChange,
    className,
}: PovertyTimeSliderProps) {
    return (
        <TimeSlider
            times={years}
            selectedTime={selectedYear}
            onChange={onChange}
            className={className}
        />
    )
}
