import {
    OwidDocumentContent,
    OwidDocumentInterface,
    OwidDocumentErrorMessage,
    OwidDocumentErrorMessageType,
    OwidDocumentType,
    checkIsOwidDocumentType,
} from "@ourworldindata/utils"

interface Handler {
    setNext: (handler: Handler) => Handler
    handle: (
        gdoc: OwidDocumentInterface,
        messages: OwidDocumentErrorMessage[]
    ) => null
}

abstract class AbstractHandler implements Handler {
    #nextHandler: Handler | null = null

    setNext(handler: Handler) {
        this.#nextHandler = handler
        return handler
    }

    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        if (this.#nextHandler) return this.#nextHandler.handle(gdoc, messages)
        return null
    }
}

class BodyHandler extends AbstractHandler {
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        const { body } = gdoc.content
        if (!body) {
            messages.push(getMissingContentPropertyError("body"))
        }

        return super.handle(gdoc, messages)
    }
}

class TitleHandler extends AbstractHandler {
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        const { title } = gdoc.content
        if (!title) {
            messages.push(getMissingContentPropertyError("title"))
        }

        return super.handle(gdoc, messages)
    }
}

class SlugHandler extends AbstractHandler {
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        const { slug } = gdoc
        if (!slug) {
            messages.push({
                property: "slug",
                type: OwidDocumentErrorMessageType.Error,
                message: `Missing slug`,
            })
        } else if (!slug.match(/^[a-z0-9-]+$/)) {
            messages.push({
                property: "slug",
                type: OwidDocumentErrorMessageType.Error,
                message: `Slug must only contain lowercase letters, numbers and hyphens`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

class PublishedAtHandler extends AbstractHandler {
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        const { publishedAt } = gdoc
        if (!publishedAt) {
            messages.push({
                property: "publishedAt",
                type: OwidDocumentErrorMessageType.Warning,
                message: `The publication date will be set to the current date on publishing.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

export class ExcerptHandler extends AbstractHandler {
    static maxLength = 150
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        const { excerpt } = gdoc.content
        if (!excerpt) {
            messages.push(getMissingContentPropertyError("excerpt"))
        } else if (excerpt.length > ExcerptHandler.maxLength) {
            messages.push({
                property: "excerpt",
                type: OwidDocumentErrorMessageType.Warning,
                message: `Long excerpts may not display well in our list of articles or on social media.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

export class AttachmentsHandler extends AbstractHandler {
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        // These errors come from the server and we can't currently easily match them to their origin
        // So instead we just render them all on the settings drawer
        gdoc.errors?.forEach((error) => messages.push(error))
        return super.handle(gdoc, messages)
    }
}

export class DocumentTypeHandler extends AbstractHandler {
    handle(gdoc: OwidDocumentInterface, messages: OwidDocumentErrorMessage[]) {
        if (!gdoc.content.type || !checkIsOwidDocumentType(gdoc.content.type)) {
            messages.push({
                property: "content",
                message: `Invalid or unset document type. Must be one-of: ${Object.values(
                    OwidDocumentType
                ).join(", ")}`,
                type: OwidDocumentErrorMessageType.Error,
            })
        }
        return super.handle(gdoc, messages)
    }
}

// #gdocsvalidation Errors prevent saving published articles. Errors are only
// raised in front-end admin code at the moment (search for
// #gdocsvalidationclient in codebase), but should ultimately be performed in
// server code too (see #gdocsvalidationserver). The checks performed here
// should match the list of required fields in OwidDocumentPublished and
// OwidDocumentContentPublished types, so that gdocs coming from the DB effectively
// honor the type cast (and subsequent assumptions) in getPublishedGdocs()
export const getErrors = (
    gdoc: OwidDocumentInterface
): OwidDocumentErrorMessage[] => {
    const errors: OwidDocumentErrorMessage[] = []

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
    type: OwidDocumentErrorMessageType,
    property: keyof OwidDocumentInterface | keyof OwidDocumentContent,
    errors?: OwidDocumentErrorMessage[]
) => errors?.find((error) => error.property === property && error.type === type)

export const getPropertyMostCriticalError = (
    property: keyof OwidDocumentInterface | keyof OwidDocumentContent,
    errors: OwidDocumentErrorMessage[] | undefined
): OwidDocumentErrorMessage | undefined => {
    return (
        getPropertyFirstErrorOfType(
            OwidDocumentErrorMessageType.Error,
            property,
            errors
        ) ||
        getPropertyFirstErrorOfType(
            OwidDocumentErrorMessageType.Warning,
            property,
            errors
        )
    )
}

const getMissingContentPropertyError = (
    property: keyof OwidDocumentContent
) => {
    return {
        property,
        type: OwidDocumentErrorMessageType.Error,
        message: `Missing ${property}. Add "${property}: ..." at the top of the Google Doc.`,
    }
}
