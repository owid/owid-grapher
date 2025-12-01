import * as _ from "lodash-es"
import {
    articulateEntity,
    checkIsCountry,
    countries,
    getRegionByNameOrVariantName,
    regions,
    type Region,
} from "./regions.js"
import {
    OwidGdocProfileInterface,
    type OwidGdocProfileContent,
} from "@ourworldindata/types"
import { generateToc } from "./Util.js"

export type ProfileEntity = Pick<Region, "name" | "code">

type ReplacementPair = [token: string, value: string]

const replaceTokens = (text: string, replacements: ReplacementPair[]): string =>
    replacements.reduce(
        (acc, [token, replacement]) =>
            acc.includes(token) ? acc.split(token).join(replacement) : acc,
        text
    )

/**
 * Recursively replaces strings in the given array based on the provided replacements.
 * e.g.
 * ["Data for $entityName", "$entityName is a country"] with [("$entityName", "Canada")] → ["Data for Canada", "Canada is a country"]
 */
const replaceStringsInArray = (
    items: any[],
    replacements: ReplacementPair[]
): void => {
    for (let index = 0; index < items.length; index++) {
        const item = items[index]
        if (typeof item === "string") {
            items[index] = replaceTokens(item, replacements)
        } else if (Array.isArray(item)) {
            replaceStringsInArray(item, replacements)
        } else if (item && typeof item === "object") {
            replaceStringsInObject(item as Record<string, any>, replacements)
        }
    }
}

/**
 * Recursively replaces strings in the given record based on the provided replacements.
 * e.g.
 * { title: "Data for $entityName" } with [("$entityName", "Canada")] → { title: "Data for Canada" }
 * { list: ["$entityName facts", "$entityName is a country"] } → { list: ["Canada facts", "Canada is a country"] }
 */
const replaceStringsInObject = (
    record: Record<string, any>,
    replacements: ReplacementPair[]
): void => {
    for (const key of Object.keys(record)) {
        const value = record[key]
        if (typeof value === "string") {
            record[key] = replaceTokens(value, replacements)
        } else if (Array.isArray(value)) {
            replaceStringsInArray(value, replacements)
        } else if (value && typeof value === "object") {
            replaceStringsInObject(value as Record<string, any>, replacements)
        }
    }
}

/**
 * Instantiates a profile content by replacing tokens with entity-specific values.
 */
export const instantiateProfile = (
    content: OwidGdocProfileContent,
    entity: ProfileEntity
): OwidGdocProfileContent => {
    const entityNameWithArticle = articulateEntity(entity.name)
    const replacements: ReplacementPair[] = [
        ["$entityName", entityNameWithArticle],
        ["$entityCode", entity.code],
        ["$noArticleEntityName", entity.name],
    ]

    const clonedContent = _.cloneDeep(content)

    replaceStringsInObject(clonedContent, replacements)

    const region = getRegionByNameOrVariantName(entity.name)
    if (region) {
        clonedContent.instantiatedEntity = {
            ...region,
            isCountry: checkIsCountry(region),
        }
    }

    if (clonedContent["sidebar-toc"]) {
        clonedContent.toc = generateToc(clonedContent.body, true)
    }

    return clonedContent
}

export function getEntitiesForProfile(
    profileTemplate: OwidGdocProfileInterface
): ProfileEntity[] {
    const scopeRaw = profileTemplate.content.scope
    if (!scopeRaw) return []

    const scopeValues = scopeRaw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)

    const entitiesByCode = new Map<string, ProfileEntity>()
    const addEntity = (region?: { name?: string; code?: string }): void => {
        if (!region?.code || !region?.name) return
        if (!entitiesByCode.has(region.code)) {
            entitiesByCode.set(region.code, {
                name: region.name,
                code: region.code,
            })
        }
    }

    const continents = regions.filter(
        (region) => region.regionType === "continent"
    )

    for (const scopeValue of scopeValues) {
        // Add all countries
        if (scopeValue === "countries" || scopeValue === "all") {
            for (const country of countries) addEntity(country)
        }
        // Add all continents
        if (scopeValue === "continents" || scopeValue === "all") {
            for (const region of continents) addEntity(region)
        }
        // Add specific entity by name or code
        if (
            scopeValue !== "countries" &&
            scopeValue !== "continents" &&
            scopeValue !== "all"
        ) {
            addEntity(getRegionByNameOrVariantName(scopeValue))
        }
    }

    return Array.from(entitiesByCode.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    )
}
