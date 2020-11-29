import * as ReactDOMServer from "react-dom/server"
import * as lodash from "lodash"
import { quote } from "shell-quote"
import urljoin from "url-join"
import { ADMIN_BASE_URL } from "settings"
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

export const exec = (
    command: string,
    options?: shell.ExecOptions
): Promise<ExecReturn> =>
    new Promise((resolve, reject) => {
        shell.exec(command, options || {}, (code, stdout, stderr) =>
            code === 0
                ? resolve({ code, stdout, stderr })
                : reject(new ExecError({ code, stdout, stderr }))
        )
    })

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

export const csvEscape = (value: any) => {
    if (lodash.includes(lodash.toString(value), ","))
        return `"${value.replace(/\"/g, '""')}"`
    return value
}

export const csvRow = (arr: string[]) =>
    arr.map((x) => csvEscape(x)).join(",") + "\n"

export const absoluteUrl = (path: string) => urljoin(ADMIN_BASE_URL, path)

// Take an arbitrary string and turn it into a nice url slug
export const slugify = (str: string) => {
    str = str
        .toLowerCase()
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w- ]+/g, "")
    return lodash.trim(str).replace(/ +/g, "-")
}

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
    return await exec(formatCmd, { silent: !verbose })
}

import filenamify from "filenamify"
export { filenamify }
