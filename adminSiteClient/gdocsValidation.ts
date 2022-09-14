import { OwidArticleType } from "../clientUtils/owidTypes.js"

export enum ErrorMessageType {
    Error = "error",
    Warning = "warning",
}

export interface ErrorMessage {
    property: keyof OwidArticleType
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
        const { title } = gdoc
        if (!title) {
            messages.push({
                property: "title",
                type: ErrorMessageType.Error,
                message: `Missing title`,
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
