import {
    EntityName,
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocProfileContent,
    OwidGdocProfileInterface,
    OwidGdocProfileEntitySummary,
    OwidGdocProfileScope,
} from "@ourworldindata/types"
import {
    getRegionByNameOrVariantName,
    removeTrailingParenthetical,
    instantiateProfile,
    ProfileEntity,
    slugify,
    filterIncompleteDataCallouts,
} from "@ourworldindata/utils"
import * as db from "../../db.js"
import { GdocBase } from "./GdocBase.js"
import {
    extractDataCalloutUrls,
    loadLinkedCalloutsForBlocks,
} from "./dataCallouts.js"

const GENERIC_PROFILE_SCOPES = new Set<OwidGdocProfileScope>([
    "countries",
    "continents",
    "all",
])

export function checkIsValidGenericScope(
    scope: string
): scope is OwidGdocProfileScope {
    const normalisedScope = scope.toLowerCase()
    return GENERIC_PROFILE_SCOPES.has(normalisedScope as OwidGdocProfileScope)
}

export function checkIsEntityNameScope(scope: string): boolean {
    const normalisedScope = scope.toLowerCase()
    const scopeWithoutParenthetical =
        removeTrailingParenthetical(normalisedScope)

    return (
        !!getRegionByNameOrVariantName(normalisedScope) ||
        !!getRegionByNameOrVariantName(scopeWithoutParenthetical)
    )
}

export class GdocProfile extends GdocBase implements OwidGdocProfileInterface {
    declare content: OwidGdocProfileContent
    instantiatedEntity?: OwidGdocProfileEntitySummary

    constructor(id?: string) {
        super(id)
    }

    static create(obj: OwidGdocBaseInterface): GdocProfile {
        const gdoc = new GdocProfile(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }

    override _validateSubclass = async (
        _knex: db.KnexReadonlyTransaction
    ): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        const scopeValues = this.normalisedScopeValues()

        if (scopeValues.length === 0) {
            errors.push({
                property: "scope",
                type: OwidGdocErrorMessageType.Error,
                message:
                    "Missing a scope field in the front-matter. Provide a comma-separated list such as 'countries' or 'China, United States'.",
            })
            return errors
        }

        const unknownScopes = scopeValues.filter(
            (value) => !this.scopeIsRecognised(value)
        )

        if (unknownScopes.length > 0) {
            for (const scope of unknownScopes) {
                errors.push({
                    property: "scope",
                    type: OwidGdocErrorMessageType.Error,
                    message: `The scope '${scope}' is not recognised. Use 'countries', 'regions', 'all', or the name/code of a known entity (e.g. 'North America').`,
                })
            }
        }

        return errors
    }

    private normalisedScopeValues(): string[] {
        if (!this.content.scope) return []
        return this.content.scope
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
    }

    private scopeIsRecognised(scope: string): boolean {
        return checkIsValidGenericScope(scope) || checkIsEntityNameScope(scope)
    }
}

/**
 * Renders a profile template for a specific entity by replacing template tokens
 * with entity-specific values.
 *
 * For bulk baking (SiteBaker) and previews, pass knex so callout values can be
 * loaded from the database instead of recomputing.
 *
 * @param profileTemplate - The profile template to instantiate
 * @param entity - The entity to instantiate the profile for
 * @param options - Optional knex transaction for loading callout values
 */
export async function instantiateProfileForEntity(
    profileTemplate: GdocProfile,
    entity: ProfileEntity,
    options?: { knex: db.KnexReadonlyTransaction }
): Promise<OwidGdocProfileInterface> {
    // Instantiate the content with entity-specific values
    const instantiatedContent = instantiateProfile(
        profileTemplate.content,
        entity
    )

    const calloutUrls = extractDataCalloutUrls(instantiatedContent.body)

    // Load precomputed callout values from the database when available
    const linkedCallouts = options?.knex
        ? await loadLinkedCalloutsForBlocks(options.knex, calloutUrls)
        : {}

    // Filter out data-callout blocks that have incomplete data
    filterIncompleteDataCallouts(instantiatedContent, linkedCallouts)

    return {
        ...profileTemplate,
        content: instantiatedContent,
        linkedCallouts,
        slug: getSlugForProfileEntity(profileTemplate, entity),
    }
}

export function getSlugForProfileEntity(
    profileTemplate: GdocProfile,
    entity: ProfileEntity
): string {
    const region = getRegionByNameOrVariantName(entity.name)
    const entitySlug = region ? region.slug : slugify(entity.name)
    return `profile/${profileTemplate.slug}/${entitySlug}`
}
