import { HitAttributeHighlightResult } from "instantsearch.js"
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

export function pickEntitiesForChartHit(
    availableEntitiesHighlighted: HitAttributeHighlightResult[] | undefined,
    availableEntities: EntityName[] | undefined,
    searchQueryRegionsMatches: Region[] | undefined
): EntityName[] {
    if (!availableEntities) return []

    const pickedEntities = new Set(
        searchQueryRegionsMatches?.map((r) => r.name)
    )

    // Build intersection of searchQueryRegionsMatches and availableEntities, so we only select entities that are actually present in the chart
    if (pickedEntities.size > 0) {
        const availableEntitiesSet = new Set(availableEntities)
        for (const entity of pickedEntities) {
            if (!availableEntitiesSet.has(entity)) {
                pickedEntities.delete(entity)
            }
        }
    }

    if (availableEntitiesHighlighted) {
        for (const highlightEntry of availableEntitiesHighlighted) {
            if (highlightEntry.matchLevel === "none") continue

            const withoutHighlightTags = removeHighlightTags(
                highlightEntry.value
            )
            if (pickedEntities.has(withoutHighlightTags)) continue

            // Remove any trailing parentheses, e.g. "Africa (UN)" -> "Africa"
            const withoutTrailingParens =
                removeTrailingParenthetical(withoutHighlightTags)

            // The sequence of words that Algolia matched; could be something like ["arab", "united", "republic"]
            // which we want to check against the entity name
            const matchedSequenceLowerCase = highlightEntry.matchedWords
                .join(" ")
                .toLowerCase()

            // Pick entity if the matched sequence contains the full entity name
            if (
                matchedSequenceLowerCase.startsWith(
                    withoutTrailingParens
                        .replaceAll("-", " ") // makes "high-income countries" into "high income countries", enabling a match
                        .toLowerCase()
                )
            )
                pickedEntities.add(withoutHighlightTags)
        }
    }

    const sortedEntities = [...pickedEntities].sort()

    return sortedEntities ?? []
}
