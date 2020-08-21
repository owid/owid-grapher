import * as ReactDOMServer from "react-dom/server"
import * as lodash from "lodash"
import { quote } from "shell-quote"
import urljoin from "url-join"
import * as settings from "settings"
import * as shell from "shelljs"
import * as util from "util"

export interface ExecReturn {
    code: number
    stdout: string
    stderr: string
}

export class ExecError extends Error implements ExecReturn {
    code: number
    stdout: string
    stderr: string

    constructor(props: ExecReturn) {
        super(props.stderr)
        this.code = props.code
        this.stdout = props.stdout
        this.stderr = props.stderr
    }
}

export function exec(
    command: string,
    options?: shell.ExecOptions
): Promise<ExecReturn> {
    return new Promise((resolve, reject) => {
        shell.exec(command, options || {}, (code, stdout, stderr) => {
            if (code !== 0) {
                return reject(new ExecError({ code, stdout, stderr }))
            }
            return resolve({ code, stdout, stderr })
        })
    })
}

// Exception format that can be easily given as an API error
export class JsonError extends Error {
    status: number
    constructor(message: string, status?: number) {
        super(message)
        this.status = status || 400
    }
}

// Fail-fast integer conversion, for e.g. ids in url params
export function expectInt(value: any): number {
    const num = parseInt(value)
    if (isNaN(num))
        throw new JsonError(`Expected integer value, not '${value}'`, 400)
    return num
}

export function tryInt(value: any, defaultNum: number): number {
    const num = parseInt(value)
    if (isNaN(num)) return defaultNum
    return num
}

// Generate a static html page string from a given JSX element
export function renderToHtmlPage(element: any): string {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

// Determine if input is suitable for use as a url slug
export function isValidSlug(slug: any) {
    return lodash.isString(slug) && slug.length > 1 && slug.match(/^[\w-]+$/)
}

export function shellEscape(s: string) {
    return quote([s])
}

export function csvEscape(value: any): string {
    const valueStr = lodash.toString(value)
    if (lodash.includes(valueStr, ",")) return `"${value.replace(/\"/g, '""')}"`
    else return value
}

export function csvRow(arr: string[]): string {
    return arr.map(x => csvEscape(x)).join(",") + "\n"
}

export function absoluteUrl(path: string): string {
    return urljoin(settings.ADMIN_BASE_URL, path)
}

// Take an arbitrary string and turn it into a nice url slug
export function slugify(s: string) {
    s = s
        .toLowerCase()
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w- ]+/g, "")
    return lodash.trim(s).replace(/ +/g, "-")
}

export const splitOnLastWord = (s: string) => {
    const endIndex = (s.lastIndexOf(" ") as number) + 1
    return {
        start: endIndex === 0 ? "" : s.substring(0, endIndex),
        end: s.substring(endIndex)
    }
}

export async function execFormatted(cmd: string, args: string[]) {
    const formatCmd = util.format(cmd, ...args.map(s => quote([s])))
    console.log(formatCmd)
    await exec(formatCmd)
}

import filenamify from "filenamify"
export { filenamify }
