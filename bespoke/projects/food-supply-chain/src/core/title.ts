import * as R from "remeda"

import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"

/** The chart's title, as a sentence about the selected country */
export function buildTitle(entityName: string): string {
    const formattedName = dropDisambiguator(
        formatEntityNameForSentence(entityName)
    )
    const possessive = formattedName.endsWith("s")
        ? `${formattedName}'`
        : `${formattedName}'s`
    return `What happens to ${possessive} food?`
}

/** The chart's subtitle: the measure's unit and the year */
export function buildSubtitle(unit: string, year: number): string {
    return `${R.capitalize(unit)}, ${year}`
}

/** Drops an OWID disambiguator, so "Micronesia (country)" reads as "Micronesia" */
function dropDisambiguator(name: string): string {
    return name.replace(/\s*\([^)]*\)$/, "")
}
