#! /usr/bin/env node

import parseArgs from "minimist"
import { docs as googleDocs } from "@googleapis/docs"
import {
    type EnrichedBlockKeyInsights,
    type OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { type OwidGdocPostContent } from "@ourworldindata/utils"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { gdocAstToEnriched } from "../../db/model/Gdoc/gdocAstToEnriched.js"
import { documentToParagraphs } from "../../db/model/Gdoc/gdocAstToParagraphs.js"
import { applyGdocWriteBack } from "../../db/model/Gdoc/gdocWriteBack.js"

const DEFAULT_DOC_ID = "18zl9dtLpoEFytwAg_TbwnhnsbShabZZRSXSSrWAt-b4"
const TARGET_INSIGHT_A =
    "terrorism is a rare cause of death globally"
const TARGET_INSIGHT_B =
    "terrorism has increased in some parts of the world, but decreased in others"

function parseDocId(raw: string | undefined): string | null {
    if (!raw) return null
    const trimmed = String(raw).trim()
    if (!trimmed) return null
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) return match[1]
    return trimmed
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

function findKeyInsightsBlock(
    body: OwidEnrichedGdocBlock[] | undefined
): { block: EnrichedBlockKeyInsights; index: number } | null {
    if (!body) return null
    const index = body.findIndex((block) => block.type === "key-insights")
    if (index < 0) return null
    const block = body[index] as EnrichedBlockKeyInsights
    return { block, index }
}

function swapKeyInsights(content: OwidGdocPostContent): void {
    const result = findKeyInsightsBlock(content.body)
    if (!result) {
        throw new Error("No key-insights block found in body.")
    }

    const { block, index } = result
    if (!Array.isArray(block.insights) || block.insights.length < 3) {
        throw new Error(
            `Key-insights block at body[${index}] has fewer than 3 insights.`
        )
    }

    const titles = block.insights.map((insight) => insight.title)
    const targetAIndex = titles.findIndex((title) =>
        title.toLowerCase().includes(TARGET_INSIGHT_A)
    )
    const targetBIndex = titles.findIndex((title) =>
        title.toLowerCase().includes(TARGET_INSIGHT_B)
    )

    if (targetAIndex < 0 || targetBIndex < 0) {
        throw new Error(
            `Could not find target insights. Titles: ${JSON.stringify(titles)}`
        )
    }

    const nextInsights = [...block.insights]
    ;[nextInsights[targetAIndex], nextInsights[targetBIndex]] = [
        nextInsights[targetBIndex],
        nextInsights[targetAIndex],
    ]
    block.insights = nextInsights
}

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    if (parsedArgs.help || parsedArgs.h) {
        console.log(`Usage:
  yarn tsx devTools/gdocs/swapKeyInsights.ts [options]

Options:
  --doc, --document-id, --url   Google Doc id or URL (defaults to test doc)
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

    const content = gdocAstToEnriched(document)
    const originalContent = JSON.parse(
        JSON.stringify(content)
    ) as OwidGdocPostContent

    swapKeyInsights(content)

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
