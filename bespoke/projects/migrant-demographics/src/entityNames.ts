import { articulateEntity } from "@ourworldindata/utils"

/**
 * "living in {X}" — the data uses OWID region names, which need an article for
 * some entities, carry a "(UN)" suffix on the UN aggregates, and capitalize
 * the income groups as if they were proper names.
 */
export function entityNameForSentence(displayName: string): string {
    if (displayName === "World") return "the world"

    const name = stripUnSuffix(displayName)
    if (ENTITIES_WITH_ARTICLE.has(name)) return `the ${name}`
    if (INCOME_GROUP_REGEX.test(name))
        return name.charAt(0).toLowerCase() + name.slice(1)
    return articulateEntity(name)
}

/**
 * Income groups read as descriptions rather than proper place names, so they
 * get a lowercase first letter mid-sentence ("living in high-income
 * countries").
 */
const INCOME_GROUP_REGEX = /-income countries$/

/** Entities that need "the" but aren't in the OWID article list */
const ENTITIES_WITH_ARTICLE = new Set(["Channel Islands"])

/**
 * The UN aggregates are named "Africa (UN)", "Latin America and the Caribbean
 * (UN)" and so on. The suffix distinguishes them from the OWID regions of the
 * same name in the dropdown, but reads as noise in a sentence.
 */
function stripUnSuffix(name: string): string {
    return name.replace(/ \(UN\)$/, "")
}
