import {
    countries,
    orderBy,
    removeTrailingParenthetical,
} from "@ourworldindata/utils"

const countriesWithVariantNames = new Set(
    countries
        .filter((country) => country.variantNames?.length || country.shortName)
        .map((country) => country.name)
)

export const processAvailableEntities = (
    availableEntities: string[] | null
) => {
    if (!availableEntities) return []

    // Algolia is a bit weird with synonyms:
    // If we have a synonym "USA" -> "United States", and we search for "USA",
    // then it seems that Algolia can only find that within `availableEntities`
    // if "USA" is within the first 100-or-so entries of the array.
    // So, the easy solution is to sort the entities to ensure that countries
    // with variant names are at the top.
    // Also, entities containing a hyphen like "low-income countries" can also
    // only be found if they're within the first 100-or-so entries.
    // - @marcelgerber, 2024-03-25
    return orderBy(
        availableEntities,
        [
            (entityName) =>
                countriesWithVariantNames.has(
                    removeTrailingParenthetical(entityName)
                ),
            (entityName) => entityName.includes("-"),
            (entityName) => entityName,
        ],
        ["desc", "desc", "asc"]
    )
}

/**
 * Scale records' positive scores to be between two numbers.
 */
export function scaleRecordScores<T extends { score: number }>(
    records: T[],
    range: [number, number]
): T[] {
    const scores = records.map((r) => r.score)
    const [min, max] = range
    const maxScore = Math.max(...scores)
    return records.map((record): T => {
        // For ExplorerView records, we want to keep negative scores,
        // because they're intentionally downranked as near-duplicates of existing views
        if (record.score < 0) return record
        // A value between 0 and 1
        const normalized = record.score / maxScore
        const scaled = Math.round(normalized * (max - min) + min)
        return {
            ...record,
            score: scaled,
        }
    })
}
