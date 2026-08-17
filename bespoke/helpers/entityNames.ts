import {
    articulateEntity,
    checkIsIncomeGroup,
    getRegionByName,
} from "@ourworldindata/utils"

/**
 * An entity name as it reads mid-sentence: "the United States", "the world",
 * "low-income countries". Income groups are descriptions rather than proper
 * place names, so they lose their leading capital.
 *
 * Takes the name as given — callers that display a shortened form (stripping
 * a " (UN)" suffix, say) should do that first.
 */
export function entityNameForSentence(entityName: string): string {
    if (entityName === "World") return "the world"
    const region = getRegionByName(entityName)
    if (region && checkIsIncomeGroup(region))
        return entityName.charAt(0).toLowerCase() + entityName.slice(1)
    return articulateEntity(entityName)
}
