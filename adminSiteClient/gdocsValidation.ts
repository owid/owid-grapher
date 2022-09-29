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

export class TitleHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ErrorMessage[]) {
        const { title } = gdoc.content
        if (!title) {
            messages.push({
                property: "title",
                type: ErrorMessageType.Error,
                message: `Missing title. Add "title: My article title" at the top of the Google Doc.`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

export class SlugHandler extends AbstractHandler {
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

export const getErrors = (gdoc: OwidArticleType): ErrorMessage[] => {
    const errors: ErrorMessage[] = []
    const titleHandler = new TitleHandler()

    titleHandler.setNext(new SlugHandler())

    titleHandler.handle(gdoc, errors)

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
