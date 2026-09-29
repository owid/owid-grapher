import * as aq from "arquero"
import { blockedFetchReason, type WebFetchResult } from "./webTools.js"
import type {
    CodeFetchResult,
    CodeFileStat,
    CodeHost,
    CodeReadResult,
    CodeRunResult,
} from "./codeTools.js"

export type CodeFetch = (url: string) => Promise<WebFetchResult>

const normalizePath = (path: string): string => {
    if (!path.startsWith("/"))
        throw new Error(`Workspace paths must be absolute: ${path}`)
    const parts: string[] = []
    for (const part of path.split("/")) {
        if (part === "" || part === ".") continue
        if (part === "..")
            throw new Error(`Workspace paths may not contain '..': ${path}`)
        parts.push(part)
    }
    return "/" + parts.join("/")
}

const stat = (path: string, text: string, updatedAt: number): CodeFileStat => ({
    path,
    chars: text.length,
    updatedAt,
})

export const createLocalCodeHost = (
    opts: { fetch?: CodeFetch } = {}
): CodeHost => {
    const files = new Map<string, { text: string; updatedAt: number }>()

    const listFiles = async (): Promise<CodeFileStat[]> =>
        [...files.entries()].map(([path, file]) =>
            stat(path, file.text, file.updatedAt)
        )

    const readFile = async (
        rawPath: string,
        readOpts: { offset?: number; maxChars?: number } = {}
    ): Promise<CodeReadResult> => {
        const path = normalizePath(rawPath)
        const file = files.get(path)
        if (!file) throw new Error(`No such workspace file: ${path}`)
        const offset = Math.max(0, Math.round(readOpts.offset ?? 0))
        const maxChars = Math.max(
            0,
            Math.round(readOpts.maxChars ?? file.text.length)
        )
        const text = file.text.slice(offset, offset + maxChars)
        const nextOffset = offset + text.length
        const truncated = nextOffset < file.text.length
        return {
            ...stat(path, file.text, file.updatedAt),
            text,
            offset,
            truncated,
            ...(truncated ? { nextOffset } : {}),
        }
    }

    const writeFile = async (
        rawPath: string,
        text: string
    ): Promise<CodeFileStat> => {
        const path = normalizePath(rawPath)
        const updatedAt = Date.now()
        files.set(path, { text, updatedAt })
        return stat(path, text, updatedAt)
    }

    const fetchFile = async (
        url: string,
        rawPath: string
    ): Promise<CodeFetchResult> => {
        if (!opts.fetch)
            throw new Error(
                "No fetch implementation is configured for the JavaScript workspace."
            )
        const reason = blockedFetchReason(url)
        if (reason) throw new Error(reason)
        const result = await opts.fetch(url)
        if (result.status >= 400)
            throw new Error(
                `The server returned HTTP ${result.status} for ${result.finalUrl}.`
            )
        const written = await writeFile(rawPath, result.body)
        return {
            ...written,
            url: result.finalUrl,
            status: result.status,
            contentType: result.contentType,
        }
    }

    const makeFetch = (): ((input: unknown) => Promise<unknown>) => {
        const fetchImpl = opts.fetch
        return async (input: unknown): Promise<unknown> => {
            if (!fetchImpl)
                throw new Error(
                    "fetch is not configured in this JavaScript workspace."
                )
            const url = typeof input === "string" ? input : String(input)
            const reason = blockedFetchReason(url)
            if (reason) throw new Error(reason)
            const result = await fetchImpl(url)
            return {
                ok: result.status >= 200 && result.status < 300,
                status: result.status,
                url: result.finalUrl,
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "content-type"
                            ? result.contentType
                            : null,
                },
                text: async () => result.body,
                json: async () => JSON.parse(result.body),
            }
        }
    }

    const runJs = async (
        code: string,
        runOpts: { timeoutMs?: number } = {}
    ): Promise<CodeRunResult> => {
        const logs: string[] = []
        const fsApi = {
            readFile: async (path: string): Promise<string> =>
                (await readFile(path)).text,
            writeFile,
            listFiles,
        }
        const consoleApi = {
            log: (...args: unknown[]) => {
                logs.push(
                    args
                        .map((arg) =>
                            typeof arg === "string" ? arg : JSON.stringify(arg)
                        )
                        .join(" ")
                )
            },
        }
        // eslint-disable-next-line no-empty-function -- only used to grab the AsyncFunction constructor
        const AsyncFunction = Object.getPrototypeOf(async function () {})
            .constructor as new (
            ...args: string[]
        ) => (...args: unknown[]) => Promise<unknown>
        const fn = new AsyncFunction(
            "fs",
            "fetch",
            "aq",
            "console",
            `"use strict";\n${code}`
        )
        const timeoutMs = Math.max(100, Math.round(runOpts.timeoutMs ?? 5_000))
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(
                () =>
                    reject(
                        new Error(`JavaScript timed out after ${timeoutMs}ms.`)
                    ),
                timeoutMs
            )
        )
        const result = await Promise.race([
            fn(fsApi, makeFetch(), aq, consoleApi),
            timeout,
        ])
        return { result, logs, files: await listFiles() }
    }

    return { listFiles, readFile, writeFile, fetchFile, runJs }
}
