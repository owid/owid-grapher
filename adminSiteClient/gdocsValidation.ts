import {
    OwidGdocContent,
    OwidGdocInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocType,
    checkIsOwidGdocType,
} from "@ourworldindata/utils"

interface Handler {
    setNext: (handler: Handler) => Handler
    handle: (gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) => null
}

abstract class AbstractHandler implements Handler {
    #nextHandler: Handler | null = null

    setNext(handler: Handler) {
        this.#nextHandler = handler
        return handler
    }

    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
        if (this.#nextHandler) return this.#nextHandler.handle(gdoc, messages)
        return null
    }
}

class BodyHandler extends AbstractHandler {
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
        const { body } = gdoc.content
        if (!body) {
            messages.push(getMissingContentPropertyError("body"))
        } else {
            for (const block of body) {
                messages.push(
                    ...block.parseErrors.map((parseError) => ({
                        message: parseError.message,
                        type: parseError.isWarning
                            ? OwidGdocErrorMessageType.Warning
                            : OwidGdocErrorMessageType.Error,
                        property: "body" as const,
                    }))
                )
            }
        }

        return super.handle(gdoc, messages)
    }
}

class TitleHandler extends AbstractHandler {
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
        const { title } = gdoc.content
        if (!title) {
            messages.push(getMissingContentPropertyError("title"))
        }

        return super.handle(gdoc, messages)
    }
}

class SlugHandler extends AbstractHandler {
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
        const { slug } = gdoc
        if (!slug) {
            messages.push({
                property: "slug",
                type: OwidGdocErrorMessageType.Error,
                message: `Missing slug`,
            })
        } else if (!slug.match(/^[a-z0-9-]+$/)) {
            messages.push({
                property: "slug",
                type: OwidGdocErrorMessageType.Error,
                message: `Slug must only contain lowercase letters, numbers and hyphens`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

class PublishedAtHandler extends AbstractHandler {
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
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

export class ExcerptHandler extends AbstractHandler {
    static maxLength = 150
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
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
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
        // These errors come from the server and we can't currently easily match them to their origin
        // So instead we just render them all on the settings drawer
        gdoc.errors?.forEach((error) => messages.push(error))
        return super.handle(gdoc, messages)
    }
}

export class DocumentTypeHandler extends AbstractHandler {
    handle(gdoc: OwidGdocInterface, messages: OwidGdocErrorMessage[]) {
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

// #gdocsvalidation Errors prevent saving published articles. Errors are only
// raised in front-end admin code at the moment (search for
// #gdocsvalidationclient in codebase), but should ultimately be performed in
// server code too (see #gdocsvalidationserver). The checks performed here
// should match the list of required fields in OwidGdocPublished and
// OwidGdocContentPublished types, so that gdocs coming from the DB effectively
// honor the type cast (and subsequent assumptions) in getPublishedGdocs()
export const getErrors = (gdoc: OwidGdocInterface): OwidGdocErrorMessage[] => {
    const errors: OwidGdocErrorMessage[] = []

    const bodyHandler = new BodyHandler()

    bodyHandler
        .setNext(new TitleHandler())
        .setNext(new SlugHandler())
        .setNext(new PublishedAtHandler())
        .setNext(new ExcerptHandler())
        .setNext(new AttachmentsHandler())
        .setNext(new DocumentTypeHandler())

    bodyHandler.handle(gdoc, errors)

    return errors
}

export const getPropertyFirstErrorOfType = (
    type: OwidGdocErrorMessageType,
    property: keyof OwidGdocInterface | keyof OwidGdocContent,
    errors?: OwidGdocErrorMessage[]
) => errors?.find((error) => error.property === property && error.type === type)

export const getPropertyMostCriticalError = (
    property: keyof OwidGdocInterface | keyof OwidGdocContent,
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

const getMissingContentPropertyError = (property: keyof OwidGdocContent) => {
    return {
        property,
        type: OwidGdocErrorMessageType.Error,
        message: `Missing ${property}. Add "${property}: ..." at the top of the Google Doc.`,
    }
}
