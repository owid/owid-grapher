import { HitAttributeHighlightResult } from "instantsearch.js/es/types/results.js"
import { IChartHit } from "./searchTypes.js"
import { EntityName } from "@ourworldindata/types"
import { removeTrailingParenthetical } from "@ourworldindata/utils"

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
