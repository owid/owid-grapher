import { HitAttributeHighlightResult } from "instantsearch.js"
import { EntityName, GrapherQueryParams } from "@ourworldindata/types"
import {
    Region,
    getRegionByNameOrVariantName,
    regions,
    escapeRegExp,
    removeTrailingParenthetical,
    lazy,
    Url,
} from "@ourworldindata/utils"
import { generateSelectedEntityNamesParam } from "@ourworldindata/grapher"

/**
 * The below code is used to search for entities we can highlight in charts and explorer results.
 *
 * There are two main functions here:
 * - `extractRegionNamesFromSearchQuery` looks at the search query (e.g. "covid cases us china asia") and extracts anything
 *   that looks like a country, region or variant name (e.g. "US"), case-insensitive.
 *   It doesn't have any knowledge of what entities are actually available.
 * - `pickEntitiesForChartHit` gets information about the entities available in a chart.
 *    It also receives the result of `extractRegionNamesFromSearchQuery`, i.e. a list of regions that are mentioned in the search query.
 *    This is useful because Algolia removes stop words like "the" and "and", which makes it difficult to match entities like
 *    "Trinidad and Tobago".
 *    - It then reduces this list to the entities that are actually available in the chart.
 *    - Afterwards, it uses the highlighted entities from Algolia to pick any other entities that are fully contained in the
 *      search query - this now adds any entities _not_ in the `regions` list, like "high-income countries" or "Salmon (farmed)".
 *
 * In practice, we use `pickEntitiesForChartHit` for explorers, since there we don't have any entity information available,
 * and can only act based on the fact that most explorers are country-based and have data for most countries and regions.
 * For charts, we use the more accurate `pickEntitiesForChartHit` function, since entity information is available.
 *
 * -- @marcelgerber, 2024-06-18
 */

const getRegionNameRegex = lazy(() => {
    const allCountryNamesAndVariants = lazy(() =>
        regions.flatMap((c) => [
            c.name,
            ...(("variantNames" in c && c.variantNames) || []),
        ])
    )

    // A RegExp that matches any country, region and variant name. Case-independent.
    return new RegExp(
        `\\b(${allCountryNamesAndVariants().map(escapeRegExp).join("|")})\\b`,
        "gi"
    )
})

export const extractRegionNamesFromSearchQuery = (query: string) => {
    const matches = query.matchAll(getRegionNameRegex())
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

export const getEntityQueryStr = (
    entities: EntityName[] | null | undefined,
    existingQueryStr: string = ""
) => {
    if (!entities?.length) return existingQueryStr
    else {
        return Url.fromQueryStr(existingQueryStr).updateQueryParams({
            // If we have any entities pre-selected, we want to show the chart tab
            tab: "chart",
            country: generateSelectedEntityNamesParam(entities),
        } satisfies GrapherQueryParams).queryStr
    }
}
