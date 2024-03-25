import { HitAttributeHighlightResult } from "instantsearch.js"
import { IChartHit } from "./searchTypes.js"
import { EntityName } from "@ourworldindata/types"
import {
    Region,
    getRegionByNameOrVariantName,
    regions,
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
            // Keep the highlight if it is fully highlighted
            if (highlightEntry.fullyHighlighted) return true
            if (highlightEntry.matchLevel === "none") return false

            // Remove any trailing parentheses, e.g. "Africa (UN)" -> "Africa"
            const withoutTrailingParens = removeTrailingParenthetical(
                removeHighlightTags(highlightEntry.value)
            )

            const matchedWordsLowerCase = highlightEntry.matchedWords.map(
                (mw) => mw.toLowerCase()
            )

            // Keep the highlight if every word (except for trailing parens) is fully highlighted
            // This will also highlight "Central African Republic" when searching for "african central republic",
            // but that's probably okay
            return withoutTrailingParens
                .toLowerCase()
                .split(" ")
                .every((w) => matchedWordsLowerCase.includes(w))
        })
        .map((highlightEntry) => removeHighlightTags(highlightEntry.value))

    return pickedEntities ?? []
}
