#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs/promises"
import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import {
    OwidGdocType,
    PostsGdocsTableName,
    type OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { type OwidGdocPostContent } from "@ourworldindata/utils"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import {
    closeTypeOrmAndKnexConnections,
    knexRawFirst,
    knexReadonlyTransaction,
} from "../../db/db.js"
import { gdocAstToEnriched } from "../../db/model/Gdoc/gdocAstToEnriched.js"
import { documentToParagraphs } from "../../db/model/Gdoc/gdocAstToParagraphs.js"
import { enrichedBlocksToXhtmlDocument } from "../../db/model/Gdoc/enrichedToXhtml.js"
import { applyGdocWriteBack } from "../../db/model/Gdoc/gdocWriteBack.js"
import { xhtmlToEnrichedBlocks } from "../../db/model/Gdoc/xhtmlToEnriched.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GdocAbout } from "../../db/model/Gdoc/GdocAbout.js"
import { GdocAuthor } from "../../db/model/Gdoc/GdocAuthor.js"
import { GdocHomepage } from "../../db/model/Gdoc/GdocHomepage.js"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"

type GdocRow = {
    id: string
    slug: string
    type: OwidGdocType
    revisionId: string | null
    rawGdoc: unknown
}

type Mode = "to-xhtml" | "from-xhtml"

function printHelp(): void {
    console.log(`Sync gdocs with XHTML (new pipeline).

Usage:
  yarn tsx devTools/gdocs/gdocXhtmlSync.ts --to-xhtml --slug <slug>
  yarn tsx devTools/gdocs/gdocXhtmlSync.ts --from-xhtml --slug <slug> [--apply]

Options:
  --to-xhtml                 Export gdoc as XHTML
  --from-xhtml               Import XHTML and write back to gdoc
  --slug <slug>              Slug to load (preferred)
  --id <gdocId>               Google Doc ID
  -i, --input <path>          XHTML input file (defaults to stdin)
  -o, --output <path>         Output file (defaults to stdout)
  --apply                     Apply write-back changes (default is dry-run)
  -h, --help                  Show this message
`)
}

function getEnricher(row: GdocRow): (content: Record<string, unknown>) => void {
    const type = row.type
    if (
        type === OwidGdocType.Article ||
        type === OwidGdocType.LinearTopicPage ||
        type === OwidGdocType.TopicPage ||
        type === OwidGdocType.Fragment
    ) {
        const gdoc = new GdocPost(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.AboutPage) {
        const gdoc = new GdocAbout(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.Author) {
        const gdoc = new GdocAuthor(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.Homepage) {
        const gdoc = new GdocHomepage(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.Announcement) {
        const gdoc = new GdocAnnouncement(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.DataInsight) {
        const gdoc = new GdocDataInsight(row.id)
        return gdoc._enrichSubclassContent
    }

    return () => undefined
}

function parseRawGdoc(raw: unknown): docs_v1.Schema$Document | null {
    if (!raw) return null
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as docs_v1.Schema$Document
        } catch {
            return null
        }
    }
    if (typeof raw === "object") {
        return raw as docs_v1.Schema$Document
    }
    return null
}

async function findGdocRow(identifier: string): Promise<GdocRow> {
    return knexReadonlyTransaction(async (knex) => {
        const bySlug = await knexRawFirst<GdocRow>(
            knex,
            `-- sql
                SELECT id, slug, type, revisionId, rawGdoc
                FROM ${PostsGdocsTableName}
                WHERE slug = ?
                LIMIT 1
            `,
            [identifier]
        )
        if (bySlug) return bySlug

        const byId = await knexRawFirst<GdocRow>(
            knex,
            `-- sql
                SELECT id, slug, type, revisionId, rawGdoc
                FROM ${PostsGdocsTableName}
                WHERE id = ?
                LIMIT 1
            `,
            [identifier]
        )
        if (byId) return byId

        throw new Error(`No gdoc found for "${identifier}".`)
    })
}

async function fetchRevisionId(
    docsClient: docs_v1.Docs,
    documentId: string
): Promise<string | null> {
    const { data } = await docsClient.documents.get({
        documentId,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        fields: "revisionId",
    })
    return data.revisionId ?? null
}

async function fetchFullDocument(
    docsClient: docs_v1.Docs,
    documentId: string
): Promise<docs_v1.Schema$Document> {
    const { data } = await docsClient.documents.get({
        documentId,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    return data
}

async function loadCurrentDocument(
    row: GdocRow,
    docsClient: docs_v1.Docs
): Promise<{
    document: docs_v1.Schema$Document
    usedCache: boolean
    liveRevisionId: string | null
}> {
    const cached = parseRawGdoc(row.rawGdoc)
    let liveRevisionId: string | null = null

    try {
        liveRevisionId = await fetchRevisionId(docsClient, row.id)
    } catch (error) {
        console.error(
            "Failed to fetch live revision id, falling back to cached rawGdoc.",
            error
        )
    }

    if (
        cached &&
        liveRevisionId &&
        row.revisionId &&
        liveRevisionId === row.revisionId
    ) {
        return { document: cached, usedCache: true, liveRevisionId }
    }

    const document = await fetchFullDocument(docsClient, row.id)
    return { document, usedCache: false, liveRevisionId }
}

function normalizeBlockType(block: OwidEnrichedGdocBlock): string {
    return block.type
}

function attachSourcesFromOriginal(
    original: OwidEnrichedGdocBlock[] | undefined,
    updated: OwidEnrichedGdocBlock[]
): void {
    if (!original || original.length === 0) return
    if (updated.length === 0) return

    const strictMatch =
        original.length === updated.length &&
        original.every(
            (block, index) =>
                normalizeBlockType(block) ===
                normalizeBlockType(updated[index])
        )

    if (strictMatch) {
        updated.forEach((block, index) => {
            const source = original[index]?._source
            if (source) {
                block._source = { ...source }
            }
        })
        return
    }

    let originalIndex = 0
    updated.forEach((block) => {
        const targetType = normalizeBlockType(block)
        while (originalIndex < original.length) {
            const candidate = original[originalIndex]
            originalIndex += 1
            if (normalizeBlockType(candidate) !== targetType) continue
            if (candidate._source) {
                block._source = { ...candidate._source }
            }
            break
        }
    })
}

async function readInput(path: string | undefined): Promise<string> {
    if (path) {
        return fs.readFile(path, "utf8")
    }

    if (process.stdin.isTTY) {
        throw new Error("No input provided. Use -i or pipe XHTML to stdin.")
    }

    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString("utf8")
}

async function writeOutput(path: string | undefined, content: string): Promise<void> {
    if (path) {
        await fs.writeFile(path, content, "utf8")
        return
    }
    process.stdout.write(content)
}

function getCurrentTextForReplacement(
    paragraphs: ReturnType<typeof documentToParagraphs>,
    replacement: { startIndex: number; endIndex: number }
): string | null {
    const parts: string[] = []
    for (const paragraph of paragraphs) {
        if (
            paragraph.startIndex === undefined ||
            paragraph.endIndex === undefined
        ) {
            continue
        }
        const overlaps =
            replacement.startIndex < paragraph.endIndex &&
            replacement.endIndex > paragraph.startIndex
        if (!overlaps) continue
        if (paragraph.type !== "paragraph") return null

        const sliceStart = Math.max(
            0,
            replacement.startIndex - paragraph.startIndex
        )
        const sliceEnd = Math.min(
            paragraph.endIndex - paragraph.startIndex,
            replacement.endIndex - paragraph.startIndex
        )
        parts.push(paragraph.text.slice(sliceStart, sliceEnd))
    }
    if (parts.length === 0) return null
    return parts.join("")
}

function renderReplacements(
    paragraphs: ReturnType<typeof documentToParagraphs>,
    replacements: Array<{ startIndex: number; endIndex: number; reason: string; newText: string }>
): string {
    if (replacements.length === 0) {
        return "No replacements needed.\n"
    }

    const lines: string[] = []
    replacements.forEach((replacement) => {
        const currentValue =
            getCurrentTextForReplacement(paragraphs, replacement) ?? ""
        lines.push(
            `- [${replacement.startIndex}, ${replacement.endIndex}) ${replacement.reason}`
        )
        lines.push("Current:")
        lines.push(currentValue)
        lines.push("Next:")
        lines.push(replacement.newText)
        lines.push("")
    })
    return `${lines.join("\n")}\n`
}

function parseMode(parsed: parseArgs.ParsedArgs): Mode {
    const toXhtml = Boolean(parsed["to-xhtml"])
    const fromXhtml = Boolean(parsed["from-xhtml"])
    if (toXhtml === fromXhtml) {
        throw new Error("Specify exactly one of --to-xhtml or --from-xhtml.")
    }
    return toXhtml ? "to-xhtml" : "from-xhtml"
}

async function main(): Promise<void> {
    const parsed = parseArgs(process.argv.slice(2))
    if (parsed.help || parsed.h) {
        printHelp()
        return
    }

    const mode = parseMode(parsed)
    const identifier = parsed.slug ?? parsed.id ?? parsed._?.[0]
    if (!identifier) {
        throw new Error("Provide a slug or gdoc id.")
    }

    const inputPath = parsed.input ?? parsed.i
    const outputPath = parsed.output ?? parsed.o
    const apply = Boolean(parsed.apply)
    if (apply && mode !== "from-xhtml") {
        throw new Error("--apply is only valid with --from-xhtml.")
    }

    const row = await findGdocRow(String(identifier))
    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docsClient = googleDocs({ version: "v1", auth })
    const { document, usedCache, liveRevisionId } = await loadCurrentDocument(
        row,
        docsClient
    )

    if (usedCache) {
        console.error(`Using cached rawGdoc for ${row.slug}.`)
    } else {
        const revisionNote =
            liveRevisionId && liveRevisionId !== row.revisionId
                ? ` (revision ${row.revisionId ?? "unknown"} -> ${liveRevisionId})`
                : ""
        console.error(
            `Fetched live gdoc for ${row.slug}${revisionNote}.`
        )
    }

    const enricher = getEnricher(row)
    const originalContent = gdocAstToEnriched(document, enricher)

    if (mode === "to-xhtml") {
        const xhtml = enrichedBlocksToXhtmlDocument(originalContent.body ?? [])
        await writeOutput(outputPath, xhtml)
        return
    }

    const xhtmlInput = await readInput(inputPath)
    const updatedBlocks = xhtmlToEnrichedBlocks(xhtmlInput)
    attachSourcesFromOriginal(originalContent.body, updatedBlocks)

    const updatedContent: OwidGdocPostContent = {
        ...originalContent,
        body: updatedBlocks,
    }

    const result = await applyGdocWriteBack(row.id, updatedContent, {
        dryRun: !apply,
        document,
        originalContent,
    })

    const paragraphs = documentToParagraphs(document)
    const output = [
        `Replacements: ${result.replacements.length}, Requests: ${result.requests.length}, Applied: ${result.applied}`,
        result.warnings.length > 0 ? "Warnings:" : "",
        ...result.warnings.map((warning) => `- ${warning}`),
        result.skipped.length > 0 ? "Skipped:" : "",
        ...result.skipped.map((skip) => `- ${skip}`),
        "Planned replacements:",
        renderReplacements(paragraphs, result.replacements),
    ]
        .filter((line) => line !== "")
        .join("\n")

    await writeOutput(outputPath, `${output}\n`)
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await closeTypeOrmAndKnexConnections()
        process.exit()
    })
