import {
    OwidArticleContent,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"

export enum ErrorMessageType {
    Error = "error",
    Warning = "warning",
}

export interface ErrorMessage {
    property: keyof OwidArticleType | keyof OwidArticleContent
    type: ErrorMessageType
    message: string
}

interface Handler {
    setNext: (handler: Handler) => Handler
    handle: (gdoc: OwidArticleType, messages: ErrorMessage[]) => null
}

abstract class AbstractHandler implements Handler {
    #nextHandler: Handler | null = null

    setNext(handler: Handler) {
        this.#nextHandler = handler
        return handler
    }

    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        if (this.#nextHandler) return this.#nextHandler.handle(gdoc, messages)
        return null
    }
}

class BodyHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { body } = gdoc.content
        if (!body) {
            messages.push(getMissingContentPropertyError("body"))
        }

        return super.handle(gdoc, messages)
    }
}

class TitleHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { title } = gdoc.content
        if (!title) {
            messages.push(getMissingContentPropertyError("title"))
        }

        return super.handle(gdoc, messages)
    }
}

class BylineHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { byline } = gdoc.content
        if (!byline) {
            messages.push(getMissingContentPropertyError("byline"))
        }

        return super.handle(gdoc, messages)
    }
}

class SlugHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { slug } = gdoc
        if (!slug) {
            messages.push({
                property: "slug",
                type: ErrorMessageType.Error,
                message: `Missing slug`,
            })
        } else if (!slug.match(/^[a-z0-9-]+$/)) {
            messages.push({
                property: "slug",
                type: ErrorMessageType.Error,
                message: `Slug must only contain lowercase letters, numbers and hyphens`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

class PublishedAtHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { publishedAt } = gdoc
        if (!publishedAt) {
            messages.push({
                property: "publishedAt",
                type: ErrorMessageType.Warning,
                message: `The publication date will be set to the current date on publishing.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

export class ExcerptHandler extends AbstractHandler {
    static maxLength = 150
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { excerpt } = gdoc.content
        if (!excerpt) {
            messages.push(getMissingContentPropertyError("excerpt"))
        } else if (excerpt.length > ExcerptHandler.maxLength) {
            messages.push({
                property: "excerpt",
                type: ErrorMessageType.Warning,
                message: `Long excerpts may not display well in our list of articles or on social media.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

// #gdocsvalidation Errors prevent saving published articles. Errors are only
// raised in front-end admin code at the moment (search for
// #gdocsvalidationclient in codebase), but should ultimately be performed in
// server code too (see #gdocsvalidationserver). The checks performed here
// should match the list of required fields in OwidArticleTypePublished and
// OwidArticleContentPublished types, so that gdocs coming from the DB effectively
// honor the type cast (and subsequent assumptions) in getPublishedGdocs()
export const getErrors = (gdoc: OwidArticleType): ErrorMessage[] => {
    const errors: ErrorMessage[] = []
    const bodyHandler = new BodyHandler()

    bodyHandler
        .setNext(new TitleHandler())
        .setNext(new BylineHandler())
        .setNext(new SlugHandler())
        .setNext(new PublishedAtHandler())
        .setNext(new ExcerptHandler())

    bodyHandler.handle(gdoc, errors)

    return errors
}

export const getPropertyFirstErrorOfType = (
    type: ErrorMessageType,
    property: keyof OwidArticleType | keyof OwidArticleContent,
    errors?: ErrorMessage[]
) => errors?.find((error) => error.property === property && error.type === type)

export const getPropertyMostCriticalError = (
    property: keyof OwidArticleType | keyof OwidArticleContent,
    errors: ErrorMessage[] | undefined
): ErrorMessage | undefined => {
    return (
        getPropertyFirstErrorOfType(ErrorMessageType.Error, property, errors) ||
        getPropertyFirstErrorOfType(ErrorMessageType.Warning, property, errors)
    )
}

const getMissingContentPropertyError = (property: keyof OwidArticleContent) => {
    return {
        property,
        type: ErrorMessageType.Error,
        message: `Missing ${property}. Add "${property}: ..." at the top of the Google Doc.`,
    }
}
