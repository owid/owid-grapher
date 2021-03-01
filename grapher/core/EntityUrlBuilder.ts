import { EntityName } from "../../coreTable/OwidTableConstants"
import { Url } from "../../clientUtils/urls/Url"
import { LegacyEntityCodesToEntityNames } from "./LegacyEntityCodesToEntityNames"

// Todo: ensure EntityName never contains the v2Delimiter

const V1_DELIMITER = "+"
export const ENTITY_V2_DELIMITER = "~"

const LegacyDimensionRegex = /\-\d+$/

const dropLegacyDimensionInEntityNames = (
    entityNames: EntityName[]
): EntityName[] => {
    // If an entity has the old name-dimension encoding, removing the dimension part and add it as a new selection. So USA-1 becomes USA.
    // This is only run against the old `country` params
    const newNames: EntityName[] = []
    entityNames.forEach((entityName) => {
        newNames.push(entityName)
        if (LegacyDimensionRegex.test(entityName)) {
            const nonDimensionName = entityName.replace(
                LegacyDimensionRegex,
                ""
            )
            newNames.push(nonDimensionName)
        }
    })
    return newNames
}

const codeToEntityName = (codeOrEntityName: string) => {
    return LegacyEntityCodesToEntityNames[codeOrEntityName] ?? codeOrEntityName
}

const entityNamesToDecodedQueryParam = (entityNames: EntityName[]): string => {
    // Always include a v2Delimiter in a v2 link. When decoding we will drop any empty strings.
    if (entityNames.length === 1) return ENTITY_V2_DELIMITER + entityNames[0]
    return entityNames.join(ENTITY_V2_DELIMITER)
}

const isV1Link = (queryParam: string) => {
    // No legacy entities have a v2Delimiter in their name, so if a v2Delimiter is present we know it's a v2 link.
    return !decodeURIComponent(queryParam).includes(ENTITY_V2_DELIMITER)
}

const decodeV1Link = (queryParam: string): EntityName[] => {
    return queryParam.split(V1_DELIMITER).map(decodeURIComponent)
}

const decodeV2Link = (queryParam: string): EntityName[] => {
    // Facebook turns %20 into +. v2 links will never contain a +, so we can safely replace all of them with %20.
    return decodeURIComponent(queryParam.replace(/\+/g, "%20"))
        .split(ENTITY_V2_DELIMITER)
        .filter((item) => item)
}

const encodedQueryParamToEntityNames = (queryParam = ""): EntityName[] => {
    // First preserve handling of the old v1 country=USA+FRA style links. If a link does not
    // include a v2Delimiter and includes a + we assume it's a v1 link. Unfortunately link sharing
    // with v1 links did not work on Facebook because FB would replace %20 with "+".
    if (queryParam === "") return []
    return isV1Link(queryParam)
        ? decodeV1Link(queryParam)
        : decodeV2Link(queryParam)
}

/**
 * Old URLs may contain the selected entities by code or by their full name. In addition, some old urls contain a selection+dimension index combo. This methods
 * migrates those old urls.
 * Important: Only ever pass not-yet-decoded URI params in here, otherwise the migration will give wrong results for legacy URLs.
 */
const migrateEncodedLegacyCountryParam = (countryParam: string) => {
    const entityNames = dropLegacyDimensionInEntityNames(
        encodedQueryParamToEntityNames(countryParam)
    ).map(codeToEntityName)
    return entityNamesToDecodedQueryParam(entityNames)
}

export const migrateCountryQueryParam = (url: Url) => {
    // need to use still-encoded URL params because we need to
    // distinguish between `+` and `%20` in legacy URLs
    const { country } = url.encodedQueryParams
    if (country === undefined) return url
    return url.updateQueryParams({
        country: undefined,
        selection: migrateEncodedLegacyCountryParam(country),
    })
}

export const getCountryQueryParam = (url: Url): EntityName[] | undefined => {
    return migrateCountryQueryParam(url)
        .queryParams.selection?.split(ENTITY_V2_DELIMITER)
        .filter((entityName) => entityName)
}

export const setCountryQueryParam = (
    url: Url,
    entityNames: EntityName[] | undefined
) => {
    return migrateCountryQueryParam(url).updateQueryParams({
        selection: entityNames
            ? entityNamesToDecodedQueryParam(entityNames)
            : undefined,
    })
}
