// The JavaScript workspace tools (code_*), ported from the
// gdocs-chrome-extension: an in-memory virtual file system plus a sandboxed
// JS runner for analysis. The document bridge differs from the extension:
// /doc/current.xhtml materializes the LIVE editor document, and
// write_doc_from_file applies file rewrites immediately (diffed by block id,
// one undo step) instead of staging them for a later apply.

import type {
    AgentTool,
    AgentToolResult,
} from "@earendil-works/pi-agent-core"
import { Type, type Static } from "typebox"
import {
    CODE_FETCH_FILE_DESCRIPTION,
    CODE_LIST_FILES_DESCRIPTION,
    CODE_MATERIALIZE_DOC_DESCRIPTION,
    CODE_READ_FILE_DESCRIPTION,
    CODE_RUN_JS_DESCRIPTION,
    CODE_WRITE_FILE_DESCRIPTION,
    WRITE_DOC_FROM_FILE_DESCRIPTION,
} from "./prompts.js"
import {
    applyDocFileDiff,
    fullDocXhtml,
    parseXhtmlBlocks,
    requireEditor,
    type DocToolHost,
} from "./docTools.js"

export interface CodeFileStat {
    path: string
    chars: number
    updatedAt: number
}

export interface CodeReadResult extends CodeFileStat {
    text: string
    offset: number
    truncated: boolean
    nextOffset?: number
}

export interface CodeRunResult {
    result: unknown
    logs: string[]
    files: CodeFileStat[]
}

export interface CodeFetchResult extends CodeFileStat {
    url: string
    status: number
    contentType: string
}

export interface CodeHost {
    listFiles(): Promise<CodeFileStat[]>
    readFile(
        path: string,
        opts?: { offset?: number; maxChars?: number }
    ): Promise<CodeReadResult>
    writeFile(path: string, text: string): Promise<CodeFileStat>
    fetchFile?(url: string, path: string): Promise<CodeFetchResult>
    runJs(code: string, opts?: { timeoutMs?: number }): Promise<CodeRunResult>
}

export interface CodeToolHost extends DocToolHost {
    code: CodeHost
}

const text = (t: string): AgentToolResult<unknown>["content"] => [
    { type: "text", text: t },
]

const clamp = (n: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, n))

const formatFiles = (files: CodeFileStat[]): string => {
    if (files.length === 0) return "No files in the JavaScript workspace."
    return files
        .toSorted((a, b) => a.path.localeCompare(b.path))
        .map((f) => `${f.path}\t${f.chars} chars`)
        .join("\n")
}

const safeJson = (value: unknown): string => {
    if (value === undefined) return "null"
    try {
        return JSON.stringify(value, null, 2)
    } catch (err) {
        return JSON.stringify(
            {
                error: "Result is not JSON-serializable",
                message: err instanceof Error ? err.message : String(err),
            },
            null,
            2
        )
    }
}

const slug = (value: string): string => {
    const out = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48)
    return out || "script"
}

let scriptCounter = 0
let runCounter = 0

/** Write the live document into the workspace (/doc/*). */
export async function materializeDocToCode(host: CodeToolHost): Promise<
    CodeFileStat[]
> {
    const editor = requireEditor(host)
    const info = host.getDocInfo()
    const current = fullDocXhtml(editor)
    const meta = {
        gdocId: info.id,
        title: info.title,
        type: info.type,
        materializedAt: new Date().toISOString(),
    }
    return Promise.all([
        host.code.writeFile("/doc/current.xhtml", current),
        host.code.writeFile("/doc/meta.json", JSON.stringify(meta, null, 2)),
    ])
}

// ---------------------------------------------------------------------------

const writeFileParams = Type.Object({
    path: Type.String({
        description: "Absolute workspace path, e.g. /data/input.csv",
    }),
    text: Type.String({ description: "Text content to write." }),
})

const codeWriteFileTool = (
    host: CodeToolHost
): AgentTool<typeof writeFileParams> => ({
    label: "Write code file",
    name: "code_write_file",
    description: CODE_WRITE_FILE_DESCRIPTION,
    parameters: writeFileParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof writeFileParams>
    ): Promise<AgentToolResult<CodeFileStat>> => {
        const stat = await host.code.writeFile(params.path, params.text)
        return {
            content: text(`Wrote ${stat.path} (${stat.chars} chars).`),
            details: stat,
        }
    },
})

const readFileParams = Type.Object({
    path: Type.String({ description: "Absolute workspace path to read." }),
    offset: Type.Optional(
        Type.Number({
            description: "Character offset to start at (default 0).",
        })
    ),
    max_chars: Type.Optional(
        Type.Number({
            description:
                "Maximum characters to return (default 12000, max 50000).",
        })
    ),
})

const codeReadFileTool = (
    host: CodeToolHost
): AgentTool<typeof readFileParams> => ({
    label: "Read code file",
    name: "code_read_file",
    description: CODE_READ_FILE_DESCRIPTION,
    parameters: readFileParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof readFileParams>
    ): Promise<AgentToolResult<CodeReadResult>> => {
        const offset = Math.max(0, Math.round(params.offset ?? 0))
        const maxChars = clamp(Math.round(params.max_chars ?? 12_000), 500, 50_000)
        const result = await host.code.readFile(params.path, {
            offset,
            maxChars,
        })
        let out = `# ${result.path}\n`
        out += `(showing characters ${result.offset}-${result.offset + result.text.length} of ${result.chars})\n\n`
        out += result.text
        if (result.truncated)
            out += `\n\n[More remains: call code_read_file with offset=${result.nextOffset}.]`
        return { content: text(out), details: result }
    },
})

const listFilesParams = Type.Object({})

const codeListFilesTool = (
    host: CodeToolHost
): AgentTool<typeof listFilesParams> => ({
    label: "List code files",
    name: "code_list_files",
    description: CODE_LIST_FILES_DESCRIPTION,
    parameters: listFilesParams,
    executionMode: "sequential",
    execute: async (): Promise<AgentToolResult<{ files: number }>> => {
        const files = await host.code.listFiles()
        return {
            content: text(formatFiles(files)),
            details: { files: files.length },
        }
    },
})

const fetchFileParams = Type.Object({
    url: Type.String({ description: "Absolute http(s) URL to fetch." }),
    path: Type.String({
        description: "Absolute workspace path to write, e.g. /data/input.csv.",
    }),
})

const codeFetchFileTool = (
    host: CodeToolHost
): AgentTool<typeof fetchFileParams> => ({
    label: "Fetch code file",
    name: "code_fetch_file",
    description: CODE_FETCH_FILE_DESCRIPTION,
    parameters: fetchFileParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof fetchFileParams>
    ): Promise<AgentToolResult<CodeFetchResult>> => {
        if (!host.code.fetchFile)
            throw new Error(
                "Fetching files into the JavaScript workspace is not available in this environment."
            )
        const result = await host.code.fetchFile(params.url, params.path)
        return {
            content: text(
                `Fetched ${result.url} into ${result.path} (${result.chars} chars, ${result.contentType || "unknown content type"}).`
            ),
            details: result,
        }
    },
})

const materializeDocParams = Type.Object({})

const codeMaterializeDocTool = (
    host: CodeToolHost
): AgentTool<typeof materializeDocParams> => ({
    label: "Materialize doc",
    name: "code_materialize_doc",
    description: CODE_MATERIALIZE_DOC_DESCRIPTION,
    parameters: materializeDocParams,
    executionMode: "sequential",
    execute: async (): Promise<AgentToolResult<{ files: number }>> => {
        const stats = await materializeDocToCode(host)
        return {
            content: text(`Wrote document files:\n${formatFiles(stats)}`),
            details: { files: stats.length },
        }
    },
})

const writeDocFromFileParams = Type.Object({})

const writeDocFromFileTool = (
    host: CodeToolHost
): AgentTool<typeof writeDocFromFileParams> => ({
    label: "Apply doc file",
    name: "write_doc_from_file",
    description: WRITE_DOC_FROM_FILE_DESCRIPTION,
    parameters: writeDocFromFileParams,
    executionMode: "sequential",
    execute: async (): Promise<
        AgentToolResult<{
            replaced: number
            inserted: number
            deleted: number
        }>
    > => {
        const editor = requireEditor(host)
        let file: CodeReadResult
        try {
            file = await host.code.readFile("/doc/current.xhtml")
        } catch {
            throw new Error(
                "There is no /doc/current.xhtml in the workspace — call code_materialize_doc first, edit the file, then retry."
            )
        }
        const blocks = parseXhtmlBlocks(file.text)
        const result = applyDocFileDiff(editor, blocks)
        // refresh the file so it reflects the applied state (incl. new ids)
        await materializeDocToCode(host)
        return {
            content: text(
                `Applied /doc/current.xhtml to the live document: ${result.replaced} replaced, ${result.inserted} inserted, ${result.deleted} deleted, ${result.unchanged} untouched. One undo step; /doc/current.xhtml refreshed.`
            ),
            details: result,
        }
    },
})

const runJsParams = Type.Object({
    code: Type.Optional(
        Type.String({
            description:
                "Inline JavaScript code to run. It will be saved under /scripts before execution.",
        })
    ),
    path: Type.Optional(
        Type.String({
            description:
                "Workspace path of a JavaScript file to run, e.g. /scripts/analyze.js. Provide either code or path.",
        })
    ),
    script_name: Type.Optional(
        Type.String({
            description:
                "Short descriptive name for an inline script file, e.g. find-country-mentions.",
        })
    ),
    timeout_ms: Type.Optional(
        Type.Number({
            description:
                "Maximum run time in milliseconds (default 5000, max 30000).",
        })
    ),
})

const codeRunJsTool = (host: CodeToolHost): AgentTool<typeof runJsParams> => ({
    label: "Run JavaScript",
    name: "code_run_js",
    description: CODE_RUN_JS_DESCRIPTION,
    parameters: runJsParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof runJsParams>
    ): Promise<
        AgentToolResult<{
            logs: number
            files: number
            script: string
            run: string
        }>
    > => {
        if ((params.code === undefined) === (params.path === undefined))
            throw new Error("Provide exactly one of code or path.")
        // keep /doc/current.xhtml fresh: the live doc changes constantly
        if (host.getEditor()) await materializeDocToCode(host)
        const timeoutMs = clamp(Math.round(params.timeout_ms ?? 5_000), 100, 30_000)
        const scriptPath =
            params.path ??
            `/scripts/${String(++scriptCounter).padStart(3, "0")}-${slug(params.script_name ?? "script")}.js`
        const source =
            params.path !== undefined
                ? (await host.code.readFile(params.path)).text
                : (params.code ?? "")
        if (params.path === undefined)
            await host.code.writeFile(scriptPath, source)
        const runDir = `/runs/${String(++runCounter).padStart(3, "0")}-${slug(
            scriptPath.split("/").pop() ?? "run"
        ).replace(/-js$/, "")}`
        await host.code.writeFile(`${runDir}/script.js`, source)
        await host.code.writeFile("/runs/latest/script.js", source)
        let result: CodeRunResult
        try {
            result = await host.code.runJs(source, { timeoutMs })
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            await Promise.all([
                host.code.writeFile(`${runDir}/error.txt`, message),
                host.code.writeFile("/runs/latest/error.txt", message),
            ])
            throw new Error(
                `JavaScript failed. Error written to ${runDir}/error.txt and /runs/latest/error.txt.\n${message}`,
                { cause: err }
            )
        }
        const rendered =
            result.result === undefined
                ? "undefined"
                : typeof result.result === "string"
                  ? result.result
                  : safeJson(result.result)
        await Promise.all([
            host.code.writeFile(`${runDir}/stdout.txt`, result.logs.join("\n")),
            host.code.writeFile(
                "/runs/latest/stdout.txt",
                result.logs.join("\n")
            ),
            host.code.writeFile(`${runDir}/result.json`, safeJson(result.result)),
            host.code.writeFile(
                "/runs/latest/result.json",
                safeJson(result.result)
            ),
        ])
        const files = await host.code.listFiles()
        let out = ""
        out += `Script: ${scriptPath}\nRun: ${runDir}\n\n`
        if (result.logs.length > 0) out += `Logs:\n${result.logs.join("\n")}\n\n`
        out += `Result:\n${rendered}`
        out += `\n\nFiles:\n${formatFiles(files)}`
        return {
            content: text(out),
            details: {
                logs: result.logs.length,
                files: files.length,
                script: scriptPath,
                run: runDir,
            },
        }
    },
})

export function createCodeTools(host: CodeToolHost): AgentTool[] {
    return [
        codeListFilesTool(host) as AgentTool,
        codeWriteFileTool(host) as AgentTool,
        codeReadFileTool(host) as AgentTool,
        codeFetchFileTool(host) as AgentTool,
        codeMaterializeDocTool(host) as AgentTool,
        writeDocFromFileTool(host) as AgentTool,
        codeRunJsTool(host) as AgentTool,
    ]
}
