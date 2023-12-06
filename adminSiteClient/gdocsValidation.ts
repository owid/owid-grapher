import {
    OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocType,
    checkIsOwidGdocType,
    traverseEnrichedBlocks,
    OwidGdocErrorMessageProperty,
} from "@ourworldindata/utils"

interface Handler {
    setNext: (handler: Handler) => Handler
    handle: (
        gdoc: OwidGdocPostInterface,
        messages: OwidGdocErrorMessage[]
    ) => null
}

abstract class AbstractHandler implements Handler {
    #nextHandler: Handler | null = null

    setNext(handler: Handler) {
        this.#nextHandler = handler
        return handler
    }

    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        if (this.#nextHandler) return this.#nextHandler.handle(gdoc, messages)
        return null
    }
}

class BodyHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const { body } = gdoc.content
        if (!body) {
            messages.push(getMissingContentPropertyError("body"))
        } else {
            for (const block of body) {
                traverseEnrichedBlocks(block, (block) => {
                    messages.push(
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

        return super.handle(gdoc, messages)
    }
}

class TitleHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const { title } = gdoc.content
        if (!title) {
            messages.push(getMissingContentPropertyError("title"))
        }

        return super.handle(gdoc, messages)
    }
}

class RSSFieldsHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const rssTitle = gdoc.content["atom-title"]
        const rssExcerpt = gdoc.content["atom-excerpt"]

        if (rssTitle && typeof rssTitle !== "string") {
            messages.push({
                property: "atom-title",
                message: "atom-title must be a string",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        if (rssExcerpt && typeof rssExcerpt !== "string") {
            messages.push({
                property: "atom-excerpt",
                message: "atom-excerpt must be a string",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        return super.handle(gdoc, messages)
    }
}

class SlugHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const { slug } = gdoc
        // !slug would be invalid, but we call setSlugSyncing(true) in GdocsSlug.tsx if that happens
        if (slug && !slug.match(/^[a-z0-9-\/]+$/)) {
            messages.push({
                property: "slug",
                type: OwidGdocErrorMessageType.Error,
                message: `Slug must only contain lowercase letters, numbers and hyphens. Double underscores are interpreted as slashes.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

class PublishedAtHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const { publishedAt } = gdoc
        if (!publishedAt) {
            messages.push({
                property: "publishedAt",
                type: OwidGdocErrorMessageType.Warning,
                message: `The publication date will be set to the current date on publishing.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

class BreadcrumbsHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const { breadcrumbs } = gdoc

        if (breadcrumbs) {
            for (const [i, breadcrumb] of breadcrumbs.entries()) {
                if (!breadcrumb.label) {
                    messages.push({
                        property: `breadcrumbs[${i}].label`,
                        type: OwidGdocErrorMessageType.Error,
                        message: `Breadcrumb must have a label`,
                    })
                }

                // Last item can be missing a href
                if (!breadcrumb.href && i !== breadcrumbs.length - 1) {
                    messages.push({
                        property: `breadcrumbs[${i}].href`,
                        type: OwidGdocErrorMessageType.Error,
                        message: `Breadcrumb must have a url`,
                    })
                }
                if (breadcrumb.href && !breadcrumb.href.startsWith("/")) {
                    messages.push({
                        property: `breadcrumbs[${i}].href`,
                        type: OwidGdocErrorMessageType.Error,
                        message: `Breadcrumb url must start with a /`,
                    })
                }
            }
        }

        return super.handle(gdoc, messages)
    }
}

export class ExcerptHandler extends AbstractHandler {
    static maxLength = 150
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        const { excerpt } = gdoc.content
        if (!excerpt) {
            messages.push(getMissingContentPropertyError("excerpt"))
        } else if (excerpt.length > ExcerptHandler.maxLength) {
            messages.push({
                property: "excerpt",
                type: OwidGdocErrorMessageType.Warning,
                message: `Long excerpts may not display well in our list of articles or on social media.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

export class AttachmentsHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        // These errors come from the server and we can't currently easily match them to their origin
        // So instead we just render them all on the settings drawer
        gdoc.errors?.forEach((error) => messages.push(error))
        return super.handle(gdoc, messages)
    }
}

export class DocumentTypeHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        if (!gdoc.content.type || !checkIsOwidGdocType(gdoc.content.type)) {
            messages.push({
                property: "content",
                message: `Invalid or unset document type. Must be one-of: ${Object.values(
                    OwidGdocType
                ).join(", ")}`,
                type: OwidGdocErrorMessageType.Error,
            })
        }
        return super.handle(gdoc, messages)
    }
}

export class RefsHandler extends AbstractHandler {
    handle(gdoc: OwidGdocPostInterface, messages: OwidGdocErrorMessage[]) {
        if (gdoc.content.refs) {
            // Errors due to refs being unused / undefined / malformed
            if (gdoc.content.refs.errors.length) {
                messages.push(...gdoc.content.refs.errors)
            }
            // Errors due to the content of the refs having parse errors
            if (gdoc.content.refs.definitions) {
                Object.values(gdoc.content.refs.definitions).map(
                    (definition) => {
                        definition.content.map((block) => {
                            traverseEnrichedBlocks(block, (node) => {
                                if (node.parseErrors.length) {
                                    for (const parseError of node.parseErrors) {
                                        messages.push({
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
                    }
                )
            }
        }

        return super.handle(gdoc, messages)
    }
}

// #gdocsvalidation Errors prevent saving published articles. Errors are only
// raised in front-end admin code at the moment (search for
// #gdocsvalidationclient in codebase), but should ultimately be performed in
// server code too (see #gdocsvalidationserver). The checks performed here
// should match the list of required fields in OwidGdocPublished and
// OwidGdocPostContentPublished types, so that gdocs coming from the DB effectively
// honor the type cast (and subsequent assumptions) in getPublishedGdocs()
export const getErrors = (
    gdoc: OwidGdocPostInterface
): OwidGdocErrorMessage[] => {
    const errors: OwidGdocErrorMessage[] = []

    const bodyHandler = new BodyHandler()

    bodyHandler
        .setNext(new TitleHandler())
        .setNext(new RSSFieldsHandler())
        .setNext(new SlugHandler())
        .setNext(new PublishedAtHandler())
        .setNext(new BreadcrumbsHandler())
        .setNext(new ExcerptHandler())
        .setNext(new AttachmentsHandler())
        .setNext(new DocumentTypeHandler())
        .setNext(new RefsHandler())

    bodyHandler.handle(gdoc, errors)

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
