import * as _ from "lodash-es"
import { articulateEntity, type Region } from "./regions.js"
import { type OwidGdocProfileContent } from "@ourworldindata/types"

export type ProfileEntity = Pick<Region, "name" | "code">

type ReplacementPair = [token: string, value: string]

const replaceTokens = (text: string, replacements: ReplacementPair[]): string =>
    replacements.reduce(
        (acc, [token, replacement]) =>
            acc.includes(token) ? acc.split(token).join(replacement) : acc,
        text
    )

const applyToOptionalString = (
    value: string | undefined,
    replacements: ReplacementPair[]
): string | undefined =>
    typeof value === "string" ? replaceTokens(value, replacements) : value

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

    clonedContent.title = replaceTokens(clonedContent.title, replacements)
    clonedContent.subtitle = applyToOptionalString(
        clonedContent.subtitle,
        replacements
    )
    if (clonedContent.excerpt) {
        clonedContent.excerpt = replaceTokens(
            clonedContent.excerpt,
            replacements
        )
    }
    if (clonedContent.toc) {
        replaceStringsInObject(clonedContent.toc, replacements)
    }
    if (clonedContent.refs) {
        replaceStringsInObject(clonedContent.refs, replacements)
    }
    if (clonedContent.body) {
        replaceStringsInObject(clonedContent.body, replacements)
    }

    return clonedContent
}
