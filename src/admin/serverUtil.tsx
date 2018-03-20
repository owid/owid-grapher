import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as _ from 'lodash'
import {quote} from 'shell-quote'

// Exception format that can be easily given as an API error
export class JsonError extends Error {
    code: number
    constructor(message: string, code?: number) {
        super(message)
        this.code = code || 400
    }
}

// Fail-fast integer conversion, for e.g. ids in url params
export function expectInt(value: any): number {
    const num = parseInt(value)
    if (isNaN(num))
        throw new JsonError(`Expected integer value, not '${value}'`, 400)
    return num
}

// Generate a static html page string from a given JSX element
export function renderToHtmlPage(element: any): string {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

// Determine if input is suitable for use as a url slug
export function isValidSlug(slug: any) {
    return _.isString(slug) && slug.length > 1 && slug.match(/^[\w-]+$/)
}

export function shellEscape(s: string) {
    return quote([s])
}