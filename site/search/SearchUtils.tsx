import { HitAttributeHighlightResult } from "instantsearch.js"
import { IChartHit } from "./searchTypes.js"
import { EntityName } from "@ourworldindata/types"
import {
    Region,
    getRegionByNameOrVariantName,
    regions,
    countries,
    escapeRegExp,
    removeTrailingParenthetical,
} from "@ourworldindata/utils"

const allCountryNamesAndVariants = regions.flatMap((c) => [
    c.name,
    ...(("variantNames" in c && c.variantNames) || []),
])

// A RegExp that matches any country, region and variant name. Case-independent.
const regionNameRegex = new RegExp(
    `\\b(${allCountryNamesAndVariants.map(escapeRegExp).join("|")})\\b`,
    "gi"
)

export const extractRegionNamesFromSearchQuery = (query: string) => {
    const matches = query.matchAll(regionNameRegex)
    const regionNames = Array.from(matches, (match) => match[0])
    if (regionNames.length === 0) return null
    return regionNames.map(getRegionByNameOrVariantName) as Region[]
}

const removeHighlightTags = (text: string) =>
    text.replace(/<\/?(mark|strong)>/g, "")

export function pickEntitiesForChartHit(hit: IChartHit): EntityName[] {
    const availableEntitiesHighlighted = hit._highlightResult
        ?.availableEntities as HitAttributeHighlightResult[] | undefined

    const pickedEntities = availableEntitiesHighlighted
        ?.filter((highlightEntry) => {
            if (highlightEntry.matchLevel === "none") return false

            // Remove any trailing parentheses, e.g. "Africa (UN)" -> "Africa"
            const entityNameWithoutTrailingParens = removeTrailingParenthetical(
                removeHighlightTags(highlightEntry.value)
            )

            // The sequence of words that Algolia matched; could be something like ["arab", "united", "republic"]
            // which we want to check against the entity name
            const matchedSequenceLowerCase = highlightEntry.matchedWords
                .join(" ")
                .toLowerCase()

            // Pick entity if the matched sequence contains the full entity name
            if (
                matchedSequenceLowerCase.startsWith(
                    entityNameWithoutTrailingParens
                        .replaceAll("-", " ") // makes "high-income countries" into "high income countries", enabling a match
                        .toLowerCase()
                )
            )
                return true

            const country = countries.find(
                (c) => c.name === entityNameWithoutTrailingParens
            )
            if (country?.variantNames) {
                // Pick entity if the matched sequence contains any of the variant names
                return country.variantNames.some((variant) =>
                    matchedSequenceLowerCase.includes(variant.toLowerCase())
                )
            }

            return false
        })
        .map((highlightEntry) => removeHighlightTags(highlightEntry.value))
        .sort()

    return pickedEntities ?? []
}
