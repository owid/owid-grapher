import {
    OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocType,
    checkIsOwidGdocType,
    traverseEnrichedBlock,
    OwidGdocErrorMessageProperty,
    OwidGdoc,
    checkIsGdocPost,
    checkIsDataInsight,
    OwidGdocDataInsightInterface,
    checkIsAuthor,
    OwidGdocAuthorInterface,
} from "@ourworldindata/utils"

function validateTitle(gdoc: OwidGdoc, errors: OwidGdocErrorMessage[]) {
    if (!gdoc.content.title) {
        errors.push(getMissingContentPropertyError("title"))
    }
}

function validatePublishedAt(gdoc: OwidGdoc, errors: OwidGdocErrorMessage[]) {
    if (!gdoc.publishedAt) {
        errors.push({
            property: "publishedAt",
            type: OwidGdocErrorMessageType.Warning,
            message: `The publication date will be set to the current date on publishing.`,
        })
    }
}

function validateSlug(gdoc: OwidGdoc, errors: OwidGdocErrorMessage[]) {
    if (!gdoc.slug.match(/^[a-z0-9-\/]+$/)) {
        errors.push({
            property: "slug",
            type: OwidGdocErrorMessageType.Error,
            message: `Slug must only contain lowercase letters, numbers and hyphens. Double underscores are interpreted as slashes.`,
        })
    }
}

function validateContentType(gdoc: OwidGdoc, errors: OwidGdocErrorMessage[]) {
    if (!gdoc.content.type || !checkIsOwidGdocType(gdoc.content.type)) {
        errors.push({
            property: "content",
            message: `Invalid or unset document type. Must be one-of: ${Object.values(
                OwidGdocType
            ).join(", ")}`,
            type: OwidGdocErrorMessageType.Error,
        })
    }
}

function validateDeprecationNotice(
    gdoc: OwidGdoc,
    errors: OwidGdocErrorMessage[]
) {
    if (
        "deprecation-notice" in gdoc.content &&
        gdoc.content.type !== OwidGdocType.Article
    ) {
        errors.push({
            property: "deprecation-notice",
            type: OwidGdocErrorMessageType.Error,
            message: "Deprecation notice is only supported in articles.",
        })
    }
}

function validateBody(gdoc: OwidGdoc, errors: OwidGdocErrorMessage[]) {
    if (!gdoc.content.body) {
        errors.push(getMissingContentPropertyError("body"))
    } else {
        for (const block of gdoc.content.body) {
            traverseEnrichedBlock(block, (block) => {
                errors.push(
                    ...block.parseErrors.map((parseError) => ({
                        message: parseError.message,
                        type: parseError.isWarning
                            ? OwidGdocErrorMessageType.Warning
                            : OwidGdocErrorMessageType.Error,
                        property: "body" as const,
                    }))
                )
            })
        }
    }
}

function validateRefs(
    gdoc: OwidGdocPostInterface,
    errors: OwidGdocErrorMessage[]
) {
    if (gdoc.content.refs) {
        // Errors due to refs being unused / undefined / malformed
        if (gdoc.content.refs.errors.length) {
            errors.push(...gdoc.content.refs.errors)
        }
        // Errors due to the content of the refs having parse errors
        if (gdoc.content.refs.definitions) {
            Object.values(gdoc.content.refs.definitions).map((definition) => {
                definition.content.map((block) => {
                    traverseEnrichedBlock(block, (node) => {
                        if (node.parseErrors.length) {
                            for (const parseError of node.parseErrors) {
                                errors.push({
                                    message: `Parse error in "${definition.id}" ref content: ${parseError.message}`,
                                    property: "refs",
                                    type: parseError.isWarning
                                        ? OwidGdocErrorMessageType.Warning
                                        : OwidGdocErrorMessageType.Error,
                                })
                            }
                        }
                    })
                })
            })
        }
    }
}

// Kind of arbitrary, see https://github.com/owid/owid-grapher/issues/2983
export const EXCERPT_MAX_LENGTH = 175

function validateExcerpt(
    gdoc: OwidGdocPostInterface,
    errors: OwidGdocErrorMessage[]
) {
    if (!gdoc.content.excerpt) {
        errors.push(getMissingContentPropertyError("excerpt"))
    } else if (gdoc.content.excerpt.length > EXCERPT_MAX_LENGTH) {
        errors.push({
            property: "excerpt",
            type: OwidGdocErrorMessageType.Warning,
            message: `Long excerpts may not display well in our list of articles or on social media.`,
        })
    }
}

function validateBreadcrumbs(
    gdoc: OwidGdocPostInterface,
    errors: OwidGdocErrorMessage[]
) {
    if (gdoc.breadcrumbs) {
        for (const [i, breadcrumb] of gdoc.breadcrumbs.entries()) {
            if (!breadcrumb.label) {
                errors.push({
                    property: `breadcrumbs[${i}].label`,
                    type: OwidGdocErrorMessageType.Error,
                    message: `Breadcrumb must have a label`,
                })
            }

            // Last item can be missing a href
            if (!breadcrumb.href && i !== gdoc.breadcrumbs.length - 1) {
                errors.push({
                    property: `breadcrumbs[${i}].href`,
                    type: OwidGdocErrorMessageType.Error,
                    message: `Breadcrumb must have a url`,
                })
            }
            if (breadcrumb.href && !breadcrumb.href.startsWith("/")) {
                errors.push({
                    property: `breadcrumbs[${i}].href`,
                    type: OwidGdocErrorMessageType.Error,
                    message: `Breadcrumb url must start with a /`,
                })
            }
        }
    }
}

function validateApprovedBy(
    gdoc: OwidGdocDataInsightInterface,
    errors: OwidGdocErrorMessage[]
) {
    if (!gdoc.content["approved-by"]) {
        errors.push({
            property: "approved-by",
            type: OwidGdocErrorMessageType.Error,
            message: `This data insight hasn't been approved by anyone yet. Please have someone approve it and add "approved-by: their name" to the front-matter.`,
        })
    }
}

function validateGrapherUrl(
    gdoc: OwidGdocDataInsightInterface,
    errors: OwidGdocErrorMessage[]
) {
    if (!gdoc.content["grapher-url"]) {
        errors.push({
            property: "grapher-url",
            type: OwidGdocErrorMessageType.Warning,
            message: `Missing "grapher-url". This isn't required, but if you're referencing a grapher, it's a good idea to add it so that we can link it to this data insight in the future. Include country selections, if applicable.`,
        })
    }
}

function validateAtomFields(
    gdoc: OwidGdocPostInterface,
    errors: OwidGdocErrorMessage[]
) {
    const rssTitle = gdoc.content["atom-title"]
    const rssExcerpt = gdoc.content["atom-excerpt"]

    if (rssTitle && typeof rssTitle !== "string") {
        errors.push({
            property: "atom-title",
            message: "atom-title must be a string",
            type: OwidGdocErrorMessageType.Error,
        })
    }

    if (rssExcerpt && typeof rssExcerpt !== "string") {
        errors.push({
            property: "atom-excerpt",
            message: "atom-excerpt must be a string",
            type: OwidGdocErrorMessageType.Error,
        })
    }
}

function validateSocials(
    gdoc: OwidGdocAuthorInterface,
    errors: OwidGdocErrorMessage[]
) {
    const { socials } = gdoc.content

    if (!socials?.parseErrors) return

    errors.push(
        ...socials.parseErrors.map((parseError) => ({
            message: parseError.message,
            type: parseError.isWarning
                ? OwidGdocErrorMessageType.Warning
                : OwidGdocErrorMessageType.Error,
            property: "socials" as const,
        }))
    )
}

export const getErrors = (gdoc: OwidGdoc): OwidGdocErrorMessage[] => {
    const errors: OwidGdocErrorMessage[] = []

    // These errors come from attachments; see GdocBase.validate()
    gdoc.errors?.forEach((error) => errors.push(error))

    validateTitle(gdoc, errors)
    validateSlug(gdoc, errors)
    validateBody(gdoc, errors)
    validatePublishedAt(gdoc, errors)
    validateContentType(gdoc, errors)
    validateDeprecationNotice(gdoc, errors)

    if (checkIsGdocPost(gdoc)) {
        validateRefs(gdoc, errors)
        validateExcerpt(gdoc, errors)
        validateBreadcrumbs(gdoc, errors)
        validateAtomFields(gdoc, errors)
    } else if (checkIsDataInsight(gdoc)) {
        validateApprovedBy(gdoc, errors)
        validateGrapherUrl(gdoc, errors)
    } else if (checkIsAuthor(gdoc)) {
        validateSocials(gdoc, errors)
    }

    return errors
}

export const getPropertyFirstErrorOfType = (
    type: OwidGdocErrorMessageType,
    property: OwidGdocErrorMessageProperty,
    errors?: OwidGdocErrorMessage[]
) => errors?.find((error) => error.property === property && error.type === type)

export const getPropertyMostCriticalError = (
    property: OwidGdocErrorMessageProperty,
    errors: OwidGdocErrorMessage[] | undefined
): OwidGdocErrorMessage | undefined => {
    return (
        getPropertyFirstErrorOfType(
            OwidGdocErrorMessageType.Error,
            property,
            errors
        ) ||
        getPropertyFirstErrorOfType(
            OwidGdocErrorMessageType.Warning,
            property,
            errors
        )
    )
}

const getMissingContentPropertyError = (
    property: keyof OwidGdocPostContent
) => {
    return {
        property,
        type: OwidGdocErrorMessageType.Error,
        message: `Missing ${property}. Add "${property}: ..." at the top of the Google Doc.`,
    }
}
