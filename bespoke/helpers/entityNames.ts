import {
    articulateEntity,
    checkIsIncomeGroup,
    getRegionByName,
} from "@ourworldindata/utils"

/**
 * Strip the parenthesised source suffixes some OWID names carry:
 * `stripEntityNameSuffixes("Africa (UN)", ["UN"])` → "Africa"
 */
export function stripEntityNameSuffixes(
    entityName: string,
    suffixes: string[]
): string {
    for (const suffix of suffixes) {
        const marker = ` (${suffix})`
        if (entityName.endsWith(marker))
            return entityName.slice(0, -marker.length)
    }
    return entityName
}

/**
 * An entity name as it reads mid-sentence: "the United States", "the world",
 * "low-income countries", "Africa". Income groups are descriptions rather than
 * proper place names, so they lose their leading capital.
 */
export function entityNameForSentence(rawEntityName: string): string {
    const entityName = stripEntityNameSuffixes(rawEntityName, ["UN"])
    if (entityName === "World") return "the world"
    const region = getRegionByName(entityName)
    if (region && checkIsIncomeGroup(region))
        return entityName.charAt(0).toLowerCase() + entityName.slice(1)
    return articulateEntity(entityName)
}
