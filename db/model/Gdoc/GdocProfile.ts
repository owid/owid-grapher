import {
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocProfileContent,
    OwidGdocProfileInterface,
    OwidGdocProfileEntitySummary,
    OwidGdocProfileScope,
} from "@ourworldindata/types"
import {
    generateToc,
    getRegionByNameOrVariantName,
    removeTrailingParenthetical,
    instantiateProfile,
    ProfileEntity,
    slugify,
} from "@ourworldindata/utils"
import * as db from "../../db.js"
import { GdocBase } from "./GdocBase.js"
import { loadAndClearLinkedCallouts } from "./dataCallouts.js"
import { PreparedCalloutTable } from "@ourworldindata/grapher"

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

    // Profiles handle callouts via instantiateProfileForEntity, not during loadState.
    // The template has $entityCode placeholders that can't be fetched until instantiated.
    override async loadAndClearLinkedCallouts(
        _knex: db.KnexReadonlyTransaction
    ): Promise<void> {
        // No-op for profiles
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

        // Validate exclude values
        const excludeValues = this.normalisedExcludeValues()
        const unknownExcludes = excludeValues.filter(
            (value) => !checkIsEntityNameScope(value)
        )

        if (unknownExcludes.length > 0) {
            for (const exclude of unknownExcludes) {
                errors.push({
                    property: "exclude",
                    type: OwidGdocErrorMessageType.Error,
                    message: `The exclude value '${exclude}' is not a recognised entity name or code.`,
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

    private normalisedExcludeValues(): string[] {
        if (!this.content.exclude) return []
        return this.content.exclude
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
 * For bulk baking (SiteBaker), pass preparedTables to use pre-fetched chart data.
 */
export async function instantiateProfileForEntity(
    profileTemplate: GdocProfile,
    entity: ProfileEntity,
    options?: {
        knex?: db.KnexReadonlyTransaction
        preparedTables?: Map<string, PreparedCalloutTable>
    }
): Promise<OwidGdocProfileInterface> {
    const instantiatedContent = instantiateProfile(
        profileTemplate.content,
        entity
    )

    const { content, linkedCallouts } = await loadAndClearLinkedCallouts(
        instantiatedContent,
        options
    )

    if (content["sidebar-toc"]) {
        content.toc = generateToc(content.body, true)
    }

    return {
        ...profileTemplate,
        content,
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
