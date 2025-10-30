import {
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocProfileContent,
    OwidGdocProfileInterface,
} from "@ourworldindata/types"
import {
    getRegionByNameOrVariantName,
    removeTrailingParenthetical,
    instantiateProfile,
    ProfileEntity,
    slugify,
} from "@ourworldindata/utils"
import * as db from "../../db.js"
import { GdocBase } from "./GdocBase.js"
import { generateToc } from "./archieToEnriched.js"

const GENERIC_PROFILE_SCOPES = new Set(["countries", "regions", "all"])

export class GdocProfile extends GdocBase implements OwidGdocProfileInterface {
    declare content: OwidGdocProfileContent

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

    override _enrichSubclassContent = (content: Record<string, any>): void => {
        const isTocForSidebar = content["sidebar-toc"]
        content.toc = generateToc(content.body, isTocForSidebar)
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
 */
export function instantiateProfileForEntity(
    profileTemplate: GdocProfile,
    entity: ProfileEntity
): OwidGdocProfileInterface {
    // Instantiate the content with entity-specific values
    const instantiatedContent = instantiateProfile(
        profileTemplate.content,
        entity
    )

    return {
        ...profileTemplate,
        content: instantiatedContent,
        // The template slug is something like "energy", and we want "profile/energy/usa"
        slug: `profile/${profileTemplate.slug}/${slugify(entity.name)}`,
    }
}
