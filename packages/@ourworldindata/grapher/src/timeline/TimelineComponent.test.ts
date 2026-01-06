import { expect, it } from "vitest"
import {
    daysSinceEpochToCalendarDate,
    calendarDateToDaysSinceEpoch,
} from "./TimelineComponent"

it("performs round-trip date conversion correctly", () => {
    const testValues = [
        // Epoch and nearby
        0,
        1,
        -1,
        // First week
        7,
        -7,
        // First month
        30,
        31,
        -30,
        -31,
        // Around leap day 2020 (Feb 29 = day 39)
        38,
        39,
        40,
        // First 100 days
        100,
        -100,
        // End of first year (2020 was leap year, so 366 days)
        345,
        346,
        365,
        366,
        // Multiple years
        730, // ~2 years
        1095, // ~3 years
        1461, // ~4 years (includes leap year)
        -365,
        -366,
        -730,
        // Large values (10+ years)
        3650, // ~10 years
        -3650,
        // Very large values (100+ years)
        36500, // ~100 years
        -36500,
        // Random values to catch edge cases
        999,
        1000,
        1001,
        -999,
        -1000,
        -1001,
    ]

    for (const original of testValues) {
        const roundTrip = calendarDateToDaysSinceEpoch(
            daysSinceEpochToCalendarDate(original)
        )
        expect(roundTrip).toEqual(original)
    }
})
