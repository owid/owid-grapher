import * as ReactDOMServer from "react-dom/server"
import * as lodash from "lodash"
import { quote } from "shell-quote"
import urljoin from "url-join"
import { ADMIN_BASE_URL } from "settings"
import * as util from "util"

// Exception format that can be easily given as an API error
export class JsonError extends Error {
    status: number
    constructor(message: string, status?: number) {
        super(message)
        this.status = status || 400
    }
}

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

export const shellEscape = (str: string) => quote([str])

export const absoluteUrl = (path: string) => urljoin(ADMIN_BASE_URL, path)

export const splitOnLastWord = (str: string) => {
    const endIndex = (str.lastIndexOf(" ") as number) + 1
    return {
        start: endIndex === 0 ? "" : str.substring(0, endIndex),
        end: str.substring(endIndex),
    }
}

export const execFormatted = async (
    cmd: string,
    args: string[],
    verbose = true
) => {
    const formatCmd = util.format(cmd, ...args.map((s) => quote([s])))
    if (verbose) console.log(formatCmd)
    return await execWrapper(formatCmd, { silent: !verbose })
}
