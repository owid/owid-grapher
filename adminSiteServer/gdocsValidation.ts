import { OwidArticleType } from "../clientUtils/owidTypes.js"

enum ValidationMessageStatus {
    Error = "error",
    Warning = "warning",
    Success = "success",
}

export interface ValidationMessage {
    status: ValidationMessageStatus
    text: string
}

interface Handler {
    setNext: (handler: Handler) => Handler
    handle: (gdoc: OwidArticleType, messages: ValidationMessage[]) => null
}

abstract class AbstractHandler implements Handler {
    #nextHandler: Handler | null = null

    setNext(handler: Handler) {
        this.#nextHandler = handler
        return handler
    }

    handle(gdoc: OwidArticleType, messages: ValidationMessage[]) {
        if (this.#nextHandler) return this.#nextHandler.handle(gdoc, messages)
        return null
    }
}

export class TitleHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ValidationMessage[]) {
        const { title } = gdoc.content
        if (!title) {
            messages.push({
                status: ValidationMessageStatus.Error,
                text: `Missing title for ${gdoc.slug}`,
            })
        } else {
            messages.push({
                status: ValidationMessageStatus.Success,
                text: `Title: ${title}`,
            })
        }

        return super.handle(gdoc, messages)
    }
}

export class DatelineHandler extends AbstractHandler {
    handle(gdoc: OwidArticleType, messages: ValidationMessage[]) {
        const { dateline } = gdoc.content
        if (!dateline) {
            messages.push({
                status: ValidationMessageStatus.Error,
                text: `Missing dateline for ${gdoc.slug}`,
            })
        } else {
            messages.push({
                status: ValidationMessageStatus.Success,
                text: `Dateline: ${dateline}`,
            })
        }

        return super.handle(gdoc, messages)
    }
}
