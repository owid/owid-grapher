// This code was adapted from https://github.com/owid/automation/blob/main/automation/mirror_explorers.py

import { ExplorerGrammar } from "@ourworldindata/explorer"

interface Statement {
    verb: string
    args: string[]
    block?: Record<string, any>[]
}

const JSON_VERSION = 1

// Constant (non-array) fields
const FLAGS: Set<string> = new Set(
    Object.keys(ExplorerGrammar).filter(
        (key) =>
            ![
                "table",
                "graphers",
                "columns",
                "selection",
                "pickerColumnSlugs",
                "yVariableIds",
            ].includes(key)
    )
)

function isBlock(verb: string, args: string[]): boolean {
    if (verb === "graphers" || verb === "columns") return true
    return verb === "table" && !args.length
}

function readBlock(
    lines: string[],
    slug: string,
    start: number
): [Record<string, any>[], number] {
    const block: string[] = []
    let i = start
    while (i < lines.length && lines[i].startsWith("\t")) {
        block.push(lines[i].slice(1).replace(/\r?$/, ""))
        i++
    }
    const records = tsvToRecords(block, slug, start)
    pruneNulls(records)
    return [records, i - start]
}

function pruneNulls(records: Record<string, any>[]): void {
    for (const r of records) {
        for (const k of Object.keys(r)) {
            if (!r[k]) delete r[k]
        }
    }
}

function tsvToRecords(
    block: string[],
    slug: string,
    start: number
): Record<string, string>[] {
    if (block[0].endsWith("\t")) {
        console.warn("loose tab on block header", {
            name: slug,
            line_no: start,
        })
    }
    // Modified: Check for empty column names with logging
    let header = block[0].replace(/\t+$/, "").split("\t")
    if (!header.every((col) => col)) {
        console.error("empty column name", { name: slug, line_no: start })
        header = header.map((col, idx) => col || `_column${idx}`)
    }
    const records: Record<string, any>[] = []
    for (const line of block.slice(1)) {
        const rowData = line.split("\t")
        const record: Record<string, string> = {}
        header.forEach((col, idx) => {
            record[col] = rowData[idx]
        })
        records.push(record)
    }
    return records
}

function parseLineByLine(lines: string[], slug: string): Statement[] {
    const filtered = lines.filter((l) => l.trim() && !l.startsWith("##"))
    const data: Statement[] = []
    let i = 0
    while (i < filtered.length) {
        const parts = filtered[i].replace(/\r?$/, "").split("\t")
        const verb = parts[0]
        const args = parts.slice(1)
        i++
        if (!isBlock(verb, args)) {
            data.push({ verb, args })
            continue
        }
        const [records, offset] = readBlock(filtered, slug, i)
        i += offset
        data.push({ verb, args, block: records })
    }
    return data
}

export function parseExplorer(
    slug: string,
    tsvContent: string
): Record<string, any> {
    console.log(`Parsing explorer for slug: ${slug}`)
    const lines = tsvContent.split(/\r?\n/)
    const statements = parseLineByLine(lines, slug)
    const result: Record<string, any> = { _version: JSON_VERSION }

    for (const s of statements) {
        if (FLAGS.has(s.verb)) {
            result[s.verb] = s.args[0] ?? null
        } else if (!["table", "graphers", "columns"].includes(s.verb)) {
            result[s.verb] = s.args
        } else {
            const blocks = result.blocks ?? []
            blocks.push({ type: s.verb, args: s.args, block: s.block })
            result.blocks = blocks
        }
    }

    if (result.isPublished === undefined) {
        result.isPublished = "false"
    }

    return result
}
