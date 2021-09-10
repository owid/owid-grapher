import * as ReactDOMServer from "react-dom/server"
import * as lodash from "lodash"
import urljoin from "url-join"
import { ADMIN_BASE_URL } from "../settings/serverSettings"
import { JsonError, WP_PostType } from "../clientUtils/owidTypes"

// Fail-fast integer conversion, for e.g. ids in url params
export const expectInt = (value: any): number => {
    const num = parseInt(value)
    if (isNaN(num))
        throw new JsonError(`Expected integer value, not '${value}'`, 400)
    return num
}

export const tryInt = (value: any, defaultNum: number): number => {
    const num = parseInt(value)
    if (isNaN(num)) return defaultNum
    return num
}

// Generate a static html page string from a given JSX element
export const renderToHtmlPage = (element: any) =>
    `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`

// Determine if input is suitable for use as a url slug
export const isValidSlug = (slug: any) =>
    lodash.isString(slug) && slug.length > 1 && slug.match(/^[\w-]+$/)

export const absoluteUrl = (path: string) => urljoin(ADMIN_BASE_URL, path)
