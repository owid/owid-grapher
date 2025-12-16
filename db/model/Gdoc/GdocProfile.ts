import {
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocProfileContent,
    OwidGdocProfileInterface,
    OwidGdocProfileEntitySummary,
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
    CalloutGrapherState,
    extractDataCalloutUrls,
    generateLinkedCalloutsFromPreparedCharts,
    loadLinkedCalloutsForBlocks,
} from "./dataCallouts.js"

const GENERIC_PROFILE_SCOPES = new Set(["countries", "continents", "all"])

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
        const normalisedScope = scope.toLowerCase()
        if (GENERIC_PROFILE_SCOPES.has(normalisedScope)) return true

        // Allow scopes that match entity names, including variations with trailing parentheticals
        const scopeWithoutParenthetical = removeTrailingParenthetical(scope)

        return (
            !!getRegionByNameOrVariantName(scope) ||
            (!!scopeWithoutParenthetical &&
                !!getRegionByNameOrVariantName(scopeWithoutParenthetical))
        )
    }
}

/**
 * Renders a profile template for a specific entity by replacing template tokens
 * with entity-specific values.
 *
 * For bulk baking (SiteBaker), pass prefetchedCalloutGrapherStates to avoid
 * redundant data fetching. For one-off rendering (admin preview, dev server),
 * pass knex and the function will load callout values itself.
 *
 * @param profileTemplate - The profile template to instantiate
 * @param entity - The entity to instantiate the profile for
 * @param options - Either prefetched callout states (for bulk baking) or knex transaction (for one-off rendering)
 */
export async function instantiateProfileForEntity(
    profileTemplate: GdocProfile,
    entity: ProfileEntity,
    options?:
        | {
              prefetchedCalloutGrapherStates: Record<
                  string,
                  CalloutGrapherState
              >
          }
        | { knex: db.KnexReadonlyTransaction }
): Promise<OwidGdocProfileInterface> {
    // Instantiate the content with entity-specific values
    const instantiatedContent = instantiateProfile(
        profileTemplate.content,
        entity
    )

    const calloutUrls = extractDataCalloutUrls(instantiatedContent.body)

    // Generate linkedCallouts based on what was provided
    let linkedCallouts
    if (options && "prefetchedCalloutGrapherStates" in options) {
        // Bulk baking path: use prefetched data
        linkedCallouts = generateLinkedCalloutsFromPreparedCharts(
            calloutUrls,
            options.prefetchedCalloutGrapherStates
        )
    } else if (options && "knex" in options) {
        // One-off rendering path: fetch data on demand
        linkedCallouts = await loadLinkedCalloutsForBlocks(
            options.knex,
            calloutUrls
        )
    } else {
        // No callout data available
        linkedCallouts = {}
    }

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
