import { formatValue } from "@ourworldindata/utils"

import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { Measure } from "./types.js"

const ENTITY_NAME_SUFFIXES_TO_STRIP = ["27", "country"]

/** A value as the chart writes it; one that would round to zero reads "<0.1 g" */
export function formatMeasureValue(
    value: number,
    {
        numDecimalPlaces,
        unit,
        showPlus,
    }: { numDecimalPlaces: number; unit?: string; showPlus?: boolean }
): string {
    const smallestShownValue = 10 ** -numDecimalPlaces
    if (value !== 0 && Math.abs(value) < smallestShownValue / 2) {
        const sign = value < 0 ? "-" : showPlus ? "+" : ""
        const bound = formatValue(smallestShownValue, {
            numDecimalPlaces,
            unit,
        })
        return `${sign}<${bound}`
    }

    return formatValue(value, { numDecimalPlaces, unit, showPlus })
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
