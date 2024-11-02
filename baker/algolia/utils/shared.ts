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
