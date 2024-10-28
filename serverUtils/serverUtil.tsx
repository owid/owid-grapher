import ReactDOMServer from "react-dom/server.js"
import * as lodash from "lodash"
import { JsonError } from "@ourworldindata/utils"
import { Base64String, HexString } from "@ourworldindata/types"

// Fail-fast integer conversion, for e.g. ids in url params
export const expectInt = (value: any): number => {
    const num = parseInt(value)
    if (isNaN(num))
        throw new JsonError(`Expected integer value, not '${value}'`, 400)
    return num
}

// Generate a static html page string from a given JSX element
export const renderToHtmlPage = (element: any) =>
    `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`

// Determine if input is suitable for use as a url slug
export const isValidSlug = (slug: any) =>
    lodash.isString(slug) && slug.length > 1 && slug.match(/^[\w-]+$/)

export function base64ToBytes(base64: Base64String): Uint8Array {
    return Buffer.from(base64, "base64")
}

export function bytesToBase64(bytes: Uint8Array): Base64String {
    return Buffer.from(bytes).toString("base64") as Base64String
}

export function hexToBytes(hex: string): Uint8Array {
    return Buffer.from(hex, "hex")
}

export function bytesToHex(bytes: Uint8Array): HexString {
    return Buffer.from(bytes).toString("hex") as HexString
}
