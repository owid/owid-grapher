import * as _ from "lodash-es"
import { match } from "ts-pattern"
import {
    articulateEntity,
    checkHasMembers,
    checkIsCountry,
    countries,
    getRegionByName,
    getRegionByNameOrVariantName,
    regions,
    type Region,
} from "./regions.js"
import {
    CalloutFunction,
    EnrichedBlockConditionalSection,
    EnrichedBlockDataCallout,
    GRAPHER_QUERY_PARAM_KEYS,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    LinkedCallouts,
    ParseError,
    SpanCallout,
    type OwidGdocProfileContent,
} from "@ourworldindata/types"

import { generateToc, traverseEnrichedBlock } from "./Util.js"
import { Url } from "./urls/Url.js"

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

const getEntityPossessive = (value: string): string => {
    const trimmedValue = value.trim()
    if (!trimmedValue) return trimmedValue
    return /s$/i.test(trimmedValue) ? `${trimmedValue}’` : `${trimmedValue}’s`
}

const capitalizeEntityName = (value: string): string => {
    if (!value) return value
    const [first, ...rest] = value
    return first.toUpperCase() + rest.join("")
}

/**
 * Instantiates a profile content by replacing tokens with entity-specific values.
 */
export const instantiateProfile = (
    content: OwidGdocProfileContent,
    entity: ProfileEntity
): OwidGdocProfileContent => {
    const entityNameWithArticle = articulateEntity(entity.name)
    const capitalizedEntity = capitalizeEntityName(entityNameWithArticle)
    const entityPossessiveWithArticle = getEntityPossessive(
        entityNameWithArticle
    )
    const entityPossessiveCapitalized = getEntityPossessive(capitalizedEntity)
    const entityPossessiveWithoutArticle = getEntityPossessive(entity.name)
    const replacements: ReplacementPair[] = [
        ["$EntityName’s", entityPossessiveCapitalized],
        ["$EntityName", capitalizedEntity],
        ["$entityName’s", entityPossessiveWithArticle],
        ["$entityName", entityNameWithArticle],
        ["$entityCode", entity.code],
        ["$noArticleEntityName’s", entityPossessiveWithoutArticle],
        ["$noArticleEntityName", entity.name],
    ]

    const clonedContent = _.cloneDeep(content)

    replaceStringsInObject(clonedContent, replacements)

    clonedContent.body.forEach((node) => {
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "conditional-section") {
                parseInstantiatedConditionalSection(block, entity.name)
            }
        })
    })

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
    scopeRaw: string,
    excludeRaw?: string
): ProfileEntity[] {
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

    // Remove excluded entities
    if (excludeRaw) {
        const excludeValues = excludeRaw
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)

        for (const excludeValue of excludeValues) {
            const region = getRegionByNameOrVariantName(excludeValue)
            if (region?.code) entitiesByCode.delete(region.code)
        }
    }

    return Array.from(entitiesByCode.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    )
}

/**
 * Conditional Section Parsing & Validation
 */

/**
 * This is the second pass to parse conditional sections after instantiation.
 * It determines whether or not the profile is instantiated for an entity that
 * matches the include/exclude criteria, and removes the content if not.
 */
function parseInstantiatedConditionalSection(
    block: EnrichedBlockConditionalSection,
    entity: string
): void {
    const shouldRender = checkShouldConditionalSectionRender({
        entity,
        include: block.include,
        exclude: block.exclude,
    })
    if (!shouldRender) {
        block.content = []
        return
    }
}

function resolveRegionList(names: string[]): {
    resolved: { region: Region; raw: string }[]
    errors: ParseError[]
} {
    const errors: ParseError[] = []
    const resolved: { region: Region; raw: string }[] = []

    for (const name of names) {
        const region = getRegionByName(name)
        if (!region) {
            errors.push({ message: `Unknown region: ${name}` })
        } else {
            resolved.push({ region, raw: name })
        }
    }
    return { resolved, errors }
}

const validationRules = {
    ensureHasEntries: function (
        includeCount: number,
        excludeCount: number
    ): ParseError[] {
        if (includeCount === 0 && excludeCount === 0) {
            return [
                {
                    message:
                        "Conditional section must specify at least one include or exclude entry",
                },
            ]
        }
        return []
    },
    ensureNoOverlap: function (
        includeRegions: { region: Region; raw: string }[],
        excludeRegions: { region: Region; raw: string }[]
    ): { errors: ParseError[]; overlapNames: string[] } {
        const includeCodes = new Map(
            includeRegions.map(({ region }) => [region.code, region.name])
        )

        const overlapNames = excludeRegions
            .map(({ region }) => includeCodes.get(region.code))
            .filter((name): name is string => !!name)

        if (overlapNames.length === 0) return { errors: [], overlapNames }

        return {
            overlapNames,
            errors: [
                {
                    message: `Entities cannot be in both include and exclude lists: ${[
                        ...new Set(overlapNames),
                    ].join(", ")}`,
                },
            ],
        }
    },
    ensureIncludeListsAreRegionsWhenExcluding: function (
        includeContainsCountry: boolean,
        hasOverlap: boolean
    ): ParseError[] {
        if (!includeContainsCountry || hasOverlap) return []
        return [
            {
                message:
                    "Include list must contain regions (not individual countries) when excludes are specified",
            },
        ]
    },
    ensureExcludesAreCovered: function (
        includeRegions: { region: Region; raw: string }[],
        excludeRegions: { region: Region; raw: string }[],
        includeContainsCountry: boolean,
        hasOverlap: boolean
    ): ParseError[] {
        if (includeContainsCountry || hasOverlap) return []

        const errors: ParseError[] = []
        for (const { region: excludedRegion } of excludeRegions) {
            const includedByAny = includeRegions.some(({ region }) => {
                if (region.code === excludedRegion.code) return true
                if (!checkHasMembers(region)) return false
                return region.members.includes(excludedRegion.code)
            })
            if (!includedByAny) {
                errors.push({
                    message: `${excludedRegion.name} is not covered by the include list`,
                })
            }
        }
        return errors
    },
}

/**
 * Validate that the include/exclude lists in a conditional section make sense.
 * e.g. include: "Europe", exclude: "France" is valid
 * e.g. include: "South America", exclude: "Germany" is invalid
 * See validationRules for more details.
 */
export function validateConditionalSectionLists(
    include: string[],
    exclude: string[]
): ParseError[] {
    const allErrors: ParseError[] = []
    const entryRuleErrors = validationRules.ensureHasEntries(
        include.length,
        exclude.length
    )
    if (entryRuleErrors.length) {
        return entryRuleErrors
    }

    const [
        { resolved: includeRegions, errors: includeErrors },
        { resolved: excludeRegions, errors: excludeErrors },
    ] = [include, exclude].map(resolveRegionList)
    allErrors.push(...includeErrors, ...excludeErrors)

    // If only one list has entries, we can skip interaction checks
    if (includeRegions.length === 0 || excludeRegions.length === 0) {
        return allErrors
    }

    const { errors: overlapErrors, overlapNames } =
        validationRules.ensureNoOverlap(includeRegions, excludeRegions)

    const hasOverlap = overlapNames.length > 0
    const includeContainsCountry = includeRegions.some(({ region }) =>
        checkIsCountry(region)
    )

    const includeErrorsRule =
        validationRules.ensureIncludeListsAreRegionsWhenExcluding(
            includeContainsCountry,
            hasOverlap
        )

    const coverageErrors = validationRules.ensureExcludesAreCovered(
        includeRegions,
        excludeRegions,
        includeContainsCountry,
        hasOverlap
    )

    allErrors.push(...overlapErrors, ...includeErrorsRule, ...coverageErrors)

    return allErrors
}

function calculateRenderLogic(
    entityRegion: Region,
    includeRegions: { region: Region; raw: string }[],
    excludeRegions: { region: Region; raw: string }[]
): boolean {
    // Helper to check if entity is in a given region (or is the region)
    const matchesCondition = (condition: Region): boolean => {
        if (condition.code === entityRegion.code) return true
        if (checkHasMembers(condition)) {
            return condition.members.includes(entityRegion.code)
        }
        return false
    }

    const isExcluded = excludeRegions.some(({ region }) =>
        matchesCondition(region)
    )

    // An empty include list means "include all"
    const isIncluded =
        includeRegions.length === 0 ||
        includeRegions.some(({ region }) => matchesCondition(region))

    return !isExcluded && isIncluded
}

export function checkShouldConditionalSectionRender({
    entity,
    include,
    exclude,
}: {
    entity: string
    include: string[]
    exclude: string[]
}): boolean {
    const entityRegion = getRegionByName(entity)
    if (!entityRegion) return false

    const { resolved: includeRegions } = resolveRegionList(include)
    const { resolved: excludeRegions } = resolveRegionList(exclude)

    return calculateRenderLogic(entityRegion, includeRegions, excludeRegions)
}

/**
 * Data callout utils
 */

// Remove all grapher query params from a URL string
// What remains is the base URL without any grapher-specific query params
// e.g. only indicator-specifying query params remain
export function stripGrapherQueryParams(url: string): string {
    const urlObj = Url.fromURL(url)
    const emptyParams = Object.fromEntries(
        GRAPHER_QUERY_PARAM_KEYS.map((key) => [key, undefined])
    )
    const strippedUrl = urlObj.updateQueryParams(emptyParams)
    return strippedUrl.fullUrl
}

// "/grapher/life-expectancy?time=2022" and "/grapher/life-expectancy?time=2020"
// both refer to the same grapher state, so they should have the same key
export function makeCalloutGrapherStateKey(fullUrl: string): string {
    const key = stripGrapherQueryParams(fullUrl)
    return key
}

// Generate a key for LinkedCallouts based on full URL (including country param)
export function makeLinkedCalloutKey(fullUrl: string): string {
    const url = Url.fromURL(fullUrl)
    const key = url.pathname + url.queryStr
    return key
}

/**
 * Check if a data-callout block has all required values available.
 * Returns true if all span-callout spans in the block have values in linkedCallouts.
 */
export function checkShouldDataCalloutRender(
    block: EnrichedBlockDataCallout,
    linkedCallouts: LinkedCallouts
): boolean {
    const key = makeLinkedCalloutKey(block.url)
    const linkedCallout = linkedCallouts[key]

    // If no callout data is available, we can't render
    if (!linkedCallout?.values) return false

    // Collect all span-callout spans from the content
    const calloutSpans: SpanCallout[] = []
    for (const contentBlock of block.content) {
        traverseEnrichedBlock(contentBlock, _.noop, (span) => {
            if (span.spanType === "span-callout") {
                calloutSpans.push(span as SpanCallout)
            }
        })
    }

    // Check if all callout values are available
    const values = linkedCallout.values
    for (const calloutSpan of calloutSpans) {
        const value = getCalloutValue(
            values,
            calloutSpan.functionName,
            calloutSpan.parameters
        )
        if (value === undefined) {
            return false
        }
    }

    return true
}

/**
 * Find the y-dimension data point matching the given shortName.
 * If shortName is omitted and there is exactly one y data point,
 * it is returned automatically — so single-indicator charts don't
 * require the column name in the callout syntax.
 */
function findYDataPoint(
    values: GrapherValuesJson,
    shortName: string | undefined
): GrapherValuesJsonDataPoint | undefined {
    if (shortName) {
        const columnSlug = values.columns
            ? Object.entries(values.columns).find(
                  ([_, col]) => col.shortName === shortName
              )?.[0]
            : undefined
        if (!columnSlug) return undefined

        return values.endValues?.y?.find(
            (dp) => dp.columnSlug === String(columnSlug)
        )
    }

    // No shortName provided: use the single y data point if unambiguous
    const yValues = values.endValues?.y
    if (yValues?.length === 1) return yValues[0]

    return undefined
}

/**
 * Look up a value from GrapherValuesJson based on the callout function name.
 * Returns the formatted value or undefined if not found.
 */
export function getCalloutValue(
    values: GrapherValuesJson,
    functionName: CalloutFunction,
    parameters: string[]
): string | undefined {
    return match(functionName)
        .with("latestValue", () => {
            return findYDataPoint(values, parameters[0])?.formattedValue
        })
        .with("latestValueWithUnit", () => {
            return findYDataPoint(values, parameters[0])?.formattedValueShort
        })
        .with("latestTime", () => {
            return findYDataPoint(values, parameters[0])?.formattedTime
        })
        .exhaustive()
}
