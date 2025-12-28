#! /usr/bin/env node

import parseArgs from "minimist"
import { docs as googleDocs } from "@googleapis/docs"
import { type Span } from "@ourworldindata/types"
import { type OwidGdocPostContent } from "@ourworldindata/utils"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { gdocAstToEnriched } from "../../db/model/Gdoc/gdocAstToEnriched.js"
import { documentToParagraphs } from "../../db/model/Gdoc/gdocAstToParagraphs.js"
import { applyGdocWriteBack } from "../../db/model/Gdoc/gdocWriteBack.js"

const DEFAULT_DOC_ID = "1uYNGqwIjsZAv7qKDLc8LitQkKjLVkGCSByCfga0QPok"
const BOOLEAN_KEYS = new Set([
    "sidebar-toc",
    "hide-subscribe-banner",
    "hide-citation",
])

function parseDocId(raw: string | undefined): string | null {
    if (!raw) return null
    const trimmed = String(raw).trim()
    if (!trimmed) return null
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) return match[1]
    return trimmed
}

function toSimpleSpans(text: string): Span[] {
    return [{ spanType: "span-simple-text", text }]
}

function parseSetPairs(
    input: string | string[] | undefined
): Array<{ key: string; value: string }> {
    if (!input) return []
    const values = Array.isArray(input) ? input : [input]
    const pairs: Array<{ key: string; value: string }> = []

    values.forEach((entry) => {
        const [rawKey, ...rest] = entry.split("=")
        const key = rawKey?.trim()
        if (!key) return
        pairs.push({ key, value: rest.join("=").trim() })
    })

    return pairs
}

function applyFrontmatterEdits(
    content: OwidGdocPostContent,
    pairs: Array<{ key: string; value: string }>
): void {
    pairs.forEach(({ key, value }) => {
        if (!value && value !== "") return

        if (key === "authors") {
            const authors = value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            content.authors = authors
            return
        }

        if (BOOLEAN_KEYS.has(key)) {
            const normalized = value.toLowerCase()
            content[key as keyof OwidGdocPostContent] = normalized === "true"
            return
        }

        content[key as keyof OwidGdocPostContent] = value
    })
}

function applyBodyEdit(
    content: OwidGdocPostContent,
    newText: string,
    targetIndex: number | null
): string | null {
    if (!content.body || content.body.length === 0) {
        return "No body blocks found."
    }

    let index = targetIndex ?? -1
    if (index < 0 || index >= content.body.length) {
        index = content.body.findIndex(
            (block) => block.type === "text" || block.type === "heading"
        )
    }

    if (index < 0 || index >= content.body.length) {
        return "No suitable text/heading block found for body edit."
    }

    const block = content.body[index]
    if (block.type === "text") {
        block.value = toSimpleSpans(newText)
        return null
    }

    if (block.type === "heading") {
        block.text = toSimpleSpans(newText)
        return null
    }

    const mutable = block as Record<string, unknown>
    if (Array.isArray(mutable.caption)) {
        mutable.caption = toSimpleSpans(newText)
        return null
    }
    if (typeof mutable.name === "string") {
        mutable.name = newText
        return null
    }
    if (typeof mutable.title === "string") {
        mutable.title = newText
        return null
    }

    return `Body block at index ${index} cannot be edited with --set-body.`
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

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    if (parsedArgs.help || parsedArgs.h) {
        console.log(`Usage:
  yarn tsx devTools/gdocs/writeBackTest.ts [options]

Options:
  --doc, --document-id, --url   Google Doc id or URL (defaults to test doc)
  --set key=value               Set frontmatter key (repeatable)
  --set-body "text"             Replace first text/heading block
  --body-index N                Target body block index for --set-body
  --apply                       Apply changes (default is dry-run)
  --print-plan                  Print planned replacements (default)
`)
        return
    }

    const docId =
        parseDocId(parsedArgs["document-id"]) ??
        parseDocId(parsedArgs.doc) ??
        parseDocId(parsedArgs.url) ??
        DEFAULT_DOC_ID

    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    const response = await docsClient.documents.get({
        documentId: docId,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    const document = response.data
    const paragraphs = documentToParagraphs(document)

    const originalContent = gdocAstToEnriched(document)
    const content = gdocAstToEnriched(document)
    const pairs = parseSetPairs(parsedArgs.set)
    const bodyText = parsedArgs["set-body"]
    const bodyIndex = Number(
        parsedArgs["body-index"] ?? parsedArgs.bodyIndex
    )
    const parsedBodyIndex = Number.isFinite(bodyIndex) ? bodyIndex : null

    applyFrontmatterEdits(content, pairs)

    if (bodyText !== undefined) {
        const error = applyBodyEdit(content, String(bodyText), parsedBodyIndex)
        if (error) {
            console.warn(error)
        }
    }

    const apply = Boolean(parsedArgs.apply)
    const result = await applyGdocWriteBack(docId, content, {
        dryRun: !apply,
        document,
        originalContent,
    })

    const shouldPrint = parsedArgs["print-plan"] !== false
    if (shouldPrint) {
        console.log(
            `Replacements: ${result.replacements.length}, Requests: ${result.requests.length}, Applied: ${result.applied}`
        )
        if (result.warnings.length > 0) {
            console.log("Warnings:")
            result.warnings.forEach((warning) => console.log(`- ${warning}`))
        }
        if (result.skipped.length > 0) {
            console.log("Skipped:")
            result.skipped.forEach((skip) => console.log(`- ${skip}`))
        }
        if (result.replacements.length > 0) {
            console.log("Planned replacements:")
            result.replacements.forEach((replacement) => {
                const currentValue = getCurrentTextForReplacement(
                    paragraphs,
                    replacement
                )
                const currentLabel =
                    currentValue === null
                        ? "<unknown>"
                        : JSON.stringify(currentValue)
                const nextLabel = JSON.stringify(replacement.newText)
                console.log(
                    `- [${replacement.startIndex}, ${replacement.endIndex}) ${replacement.reason} ${currentLabel} -> ${nextLabel}`
                )
            })
        }
    }
}

main(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error)
    process.exitCode = 1
})
