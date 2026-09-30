import { formatValue } from "@ourworldindata/utils"

import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { Measure } from "./types.js"

const ENTITY_NAME_SUFFIXES_TO_STRIP = ["27", "country"]

/** A value as the chart writes it; one too small for `numDecimalPlaces` shows down to its first significant digit */
export function formatMeasureValue(
    value: number,
    {
        numDecimalPlaces,
        unit,
        showPlus,
    }: { numDecimalPlaces: number; unit?: string; showPlus?: boolean }
): string {
    return formatValue(value, {
        numDecimalPlaces: Math.max(
            numDecimalPlaces,
            findFirstSignificantDecimalPlace(value)
        ),
        unit,
        showPlus,
    })
}

export function buildTitle(entityName: string, measure: Measure): string {
    const formattedName = formatEntityNameForSentence(
        entityName,
        ENTITY_NAME_SUFFIXES_TO_STRIP
    )
    return measure === "energy"
        ? `How many calories does ${formattedName} produce, and where do they go?`
        : `How much protein does ${formattedName} produce, and where does it go?`
}

export function buildSubtitle(measure: Measure, year: number): string {
    const quantity =
        measure === "energy" ? "number of kilocalories" : "grams of protein"
    return `Measured as the average ${quantity} per person per day at each stage, in ${year}.`
}

/** 1 for 0.3, 2 for 0.03; zero or less for values of 1 and above */
function findFirstSignificantDecimalPlace(value: number): number {
    if (value === 0) return 0
    return -Math.floor(Math.log10(Math.abs(value)))
}
