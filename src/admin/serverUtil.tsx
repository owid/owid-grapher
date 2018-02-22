import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'

export class JsonError extends Error {
    code: number
    constructor(message: string, code?: number) {
        super(message)
        this.code = code || 400
    }
}

export function expectInt(value: any): number {
    const num = parseInt(value)
    if (isNaN(num))
        throw new JsonError(`Expected integer value, not '${value}'`, 400)
    return num
}

export function renderToHtmlPage(element: any): string {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}
