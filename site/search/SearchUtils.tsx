import { HitAttributeHighlightResult } from "instantsearch.js/es/types/results.js"
import { IChartHit } from "./searchTypes.js"
import { EntityName } from "@ourworldindata/types"
import { countries, removeTrailingParenthetical } from "@ourworldindata/utils"

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
                matchedSequenceLowerCase.includes(
                    entityNameWithoutTrailingParens.toLowerCase()
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

    return pickedEntities ?? []
}
