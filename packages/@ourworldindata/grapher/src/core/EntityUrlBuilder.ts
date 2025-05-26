import { EntityName, SeriesName } from "@ourworldindata/types"
import { Url, performUrlMigrations, UrlMigration } from "@ourworldindata/utils"
import { codeToEntityName, entityNameToCode } from "./EntityCodes"

/*
 * Migration #1: Switch from + to ~ delimited entities.
 *
 * Implemented: May 2020
 *
 * See PR discussion on how we decided on ~ (tilde): https://github.com/owid/owid-grapher/pull/446
 * And the initial issue (Facebook rewriting our URLs): https://github.com/owid/owid-grapher/issues/397
 *
 * In short:
 *
 * Facebook replaces `%20` in URLs with `+`. Before this migration we encoded
 * ["North America", "South America"] → "North%20America+South%20America".
 * Facebook would turn this into "North+America+South+America" making the delimiters and spaces
 * ambiguous.
 *
 * We chose ~ (tilde) because no entities existed in the database that contain that symbol, so the
 * existence of that symbol could be used to detect legacy URLs.
 *
 */

// Todo: ensure EntityName never contains the v2Delimiter

const V1_DELIMITER = "+"
export const ENTITY_V2_DELIMITER = "~"

const isV1Param = (encodedQueryParam: string): boolean => {
    // No legacy entities have a v2Delimiter in their name,
    // so if a v2Delimiter is present we know it's a v2 link.
    return !decodeURIComponent(encodedQueryParam).includes(ENTITY_V2_DELIMITER)
}

const entityNamesFromV1EncodedParam = (
    encodedQueryParam: string
): EntityName[] => {
    // need to use still-encoded URL params because we need to
    // distinguish between `+` and `%20` in legacy URLs
    return encodedQueryParam.split(V1_DELIMITER).map(decodeURIComponent)
}

const entityNamesToV2Param = (entityNames: EntityName[]): string => {
    // Always include a v2Delimiter in a v2 link. When decoding we will drop any empty strings.
    if (entityNames.length === 1) return ENTITY_V2_DELIMITER + entityNames[0]
    return entityNames.join(ENTITY_V2_DELIMITER)
}

const entityNamesFromV2Param = (queryParam: string): EntityName[] => {
    // Facebook turns %20 into +. v2 links will never contain a +, so we can safely replace all of them with %20.
    return queryParam.split(ENTITY_V2_DELIMITER).filter((item) => item)
}

const migrateV1Delimited: UrlMigration = (url) => {
    const { country } = url.encodedQueryParams

    if (country !== undefined && isV1Param(country)) {
        return url.updateQueryParams({
            country: entityNamesToV2Param(
                entityNamesFromV1EncodedParam(country)
            ),
        })
    }
    return url
}

/*
 * Migration #2: Drop dimension keys from selected entities.
 *
 * Implemented: March 2021
 *
 * When plotting multiple variables on a chart, it used to be possible to pick which
 * variable-entity pairs get plotted.
 *
 * For example, if you had a line chart with 3 variables: Energy consumption from Coal, Oil and Gas,
 * then you (as a user) could select individual variable-entity pairs to plot:
 *
 * - France - Coal ("FRA-0")
 * - France - Oil ("FRA-1")
 * - France - Gas ("FRA-2")
 * - ...
 *
 * The index of the dimension was appended to the entity (e.g. 0 for Coal).
 *
 * We dropped this feature in March 2021 in order to simplify the selection-handling logic, and it
 * was also, in most cases, not desirable to present users with variable-entity options.
 *
 */

// Pattern for a entity name - number pair, where the entity name contains at least one non-digit character.
const LegacyDimensionRegex = /^(.*\D.*)-\d+$/

const injectEntityNamesInLegacyDimension = (
    entityNames: EntityName[]
): EntityName[] => {
    // If an entity has the old name-dimension encoding, removing the dimension part and add it as
    // a new selection. So USA-1 becomes USA.
    const newNames: EntityName[] = []
    entityNames.forEach((entityName) => {
        newNames.push(entityName)
        if (LegacyDimensionRegex.test(entityName)) {
            const nonDimensionName = entityName.replace(
                LegacyDimensionRegex,
                "$1"
            )
            newNames.push(nonDimensionName)
        }
    })
    return newNames
}

const migrateLegacyDimensionPairs: UrlMigration = (url) => {
    const { country } = url.queryParams
    if (country) {
        return url.updateQueryParams({
            country: entityNamesToV2Param(
                injectEntityNamesInLegacyDimension(
                    entityNamesFromV2Param(country)
                )
            ),
        })
    }
    return url
}

/*
 * Combining all migrations
 */

const urlMigrations: UrlMigration[] = [
    migrateV1Delimited,
    migrateLegacyDimensionPairs,
]

export const migrateSelectedEntityNamesParam: UrlMigration = (
    url: Url
): Url => {
    return performUrlMigrations(urlMigrations, url)
}

/*
 * Accessors
 */

export const getEntityNamesParam = (
    param: string | undefined
): EntityName[] | undefined => {
    if (param === undefined) return undefined
    return entityNamesFromV2Param(param).map(codeToEntityName)
}

export const getSelectedEntityNamesParam = (
    url: Url
): EntityName[] | undefined => {
    // Expects an already-migrated URL as input
    const { country } = url.queryParams
    return getEntityNamesParam(country)
}

export const generateSelectedEntityNamesParam = (
    entityNames: EntityName[]
): string => entityNamesToV2Param(entityNames.map(entityNameToCode))

export const setSelectedEntityNamesParam = (
    url: Url,
    entityNames: EntityName[] | undefined
): Url => {
    // Expects an already-migrated URL as input
    return url.updateQueryParams({
        country: entityNames
            ? generateSelectedEntityNamesParam(entityNames)
            : undefined,
    })
}

/*
 * Focused series names
 *
 * A focused series name is one of:
 * (i) an entity name (common case)
 * (ii) an indicator name (less common, but not rare)
 * (iii) a combination of both, typically represented as 'entityName – indicatorName' (rare)
 *
 * Parsing and serializing focused series names for the URL is done using utility
 * functions that have originally been written for entity names, so that the same
 * delimiter is used and entity names are mapped to their codes if possible. Note
 * that stand-alone entity names are mapped to their codes (case i), while entity
 * names that are a substring of a series name are not (case iii).
 */

export const getFocusedSeriesNamesParam = (
    queryParam: string | undefined
): SeriesName[] | undefined => {
    return getEntityNamesParam(queryParam)
}

export const generateFocusedSeriesNamesParam = (
    seriesNames: SeriesName[]
): string => entityNamesToV2Param(seriesNames.map(entityNameToCode))
