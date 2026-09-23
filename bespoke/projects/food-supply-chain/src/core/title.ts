import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { Measure } from "./types.js"

/** The chart's title, as a question about the selected country */
export function buildTitle(entityName: string, measure: Measure): string {
    const formattedName = dropDisambiguator(
        formatEntityNameForSentence(entityName)
    )
    return measure === "energy"
        ? `How many calories does ${formattedName} produce, and where do they go?`
        : `How much protein does ${formattedName} produce, and where does it go?`
}

/** The chart's subtitle: what the values measure, and the year */
export function buildSubtitle(measure: Measure, year: number): string {
    const quantity =
        measure === "energy" ? "number of kilocalories" : "grams of protein"
    return `Measured as the average ${quantity} per person per day at each stage, in ${year}.`
}

/** Drops an OWID disambiguator, so "Micronesia (country)" reads as "Micronesia" */
function dropDisambiguator(name: string): string {
    return name.replace(/\s*\([^)]*\)$/, "")
}
