#! /usr/bin/env node

/**
 * Script to fetch and save a Google Doc's AST and comments for analysis.
 *
 * This is part of Phase 2 investigation for the gdoc-comments-xhtml feature.
 * It helps us understand:
 * - The structure of the document AST from the Docs API
 * - The structure of comments from the Drive API
 * - How quotedFileContent.value relates to actual document text
 *
 * Usage:
 *   npx tsx devTools/gdocs/investigateGdocComments.ts <documentId>
 *   npx tsx devTools/gdocs/investigateGdocComments.ts  # uses default test doc
 */

import parseArgs from "minimist"
import fs from "fs"
import path from "path"

import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { docs as googleDocs } from "@googleapis/docs"
import { drive as googleDrive } from "@googleapis/drive"

// Default test document from the plan
const DEFAULT_DOCUMENT_ID = "1ostn5k5UVGAWwo0C6A3JgnF9R63_XcU8NhiIROwU8og"
const OUTPUT_DIR = "devTools/gdocs/gdoc-investigation"

async function main(documentId: string) {
    console.log(`Investigating document: ${documentId}`)
    console.log("---")

    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()

    // 1. Fetch Google Docs AST
    console.log("Fetching document AST from Docs API...")
    const docsClient = googleDocs({ version: "v1", auth })
    const { data: docAst } = await docsClient.documents.get({
        documentId,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    console.log(`  Document title: ${docAst.title}`)

    // 2. Fetch comments from Drive API
    console.log("Fetching comments from Drive API...")
    const driveClient = googleDrive({ version: "v3", auth })
    const comments: unknown[] = []
    let pageToken: string | undefined

    do {
        const response = await driveClient.comments.list({
            fileId: documentId,
            fields: "comments(id,anchor,author,content,quotedFileContent,createdTime,modifiedTime,resolved,replies),nextPageToken",
            pageSize: 100,
            pageToken,
        })
        comments.push(...(response.data.comments ?? []))
        pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)

    console.log(`  Found ${comments.length} comments`)

    // 3. Extract plain text from document for comparison
    console.log("Extracting plain text from document...")
    const plainText = extractPlainText(docAst)
    console.log(`  Extracted ${plainText.length} characters`)

    // 4. Analyze comments
    console.log("\nAnalyzing comments...")
    const analysis = analyzeComments(comments, plainText)

    // 5. Save to files
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })

    const astPath = path.join(OUTPUT_DIR, "document-ast.json")
    fs.writeFileSync(astPath, JSON.stringify(docAst, null, 2))
    console.log(`\nSaved document AST to ${astPath}`)

    const commentsPath = path.join(OUTPUT_DIR, "comments.json")
    fs.writeFileSync(commentsPath, JSON.stringify(comments, null, 2))
    console.log(`Saved ${comments.length} comments to ${commentsPath}`)

    const plainTextPath = path.join(OUTPUT_DIR, "plain-text.txt")
    fs.writeFileSync(plainTextPath, plainText)
    console.log(`Saved plain text to ${plainTextPath}`)

    const analysisPath = path.join(OUTPUT_DIR, "analysis.json")
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2))
    console.log(`Saved analysis to ${analysisPath}`)

    // 6. Print summary
    printAnalysisSummary(analysis)
}

interface Comment {
    id?: string
    anchor?: string
    content?: string
    quotedFileContent?: {
        mimeType?: string
        value?: string
    }
    author?: {
        displayName?: string
        emailAddress?: string
    }
    resolved?: boolean
    createdTime?: string
    modifiedTime?: string
    replies?: Reply[]
}

interface Reply {
    id?: string
    author?: {
        displayName?: string
        emailAddress?: string
    }
    content?: string
    createdTime?: string
    modifiedTime?: string
}

interface CommentAnalysis {
    id: string
    quotedText: string | null
    quotedTextLength: number
    foundInDocument: boolean
    matchCount: number
    firstMatchIndex: number | null
    anchorFormat: string
    resolved: boolean
    replyCount: number
    hasWhitespace: boolean
    hasNewlines: boolean
}

interface Analysis {
    totalComments: number
    resolvedComments: number
    unresolvedComments: number
    commentsWithQuotedText: number
    commentsWithoutQuotedText: number
    commentsFoundInDocument: number
    commentsNotFoundInDocument: number
    multipleMatchComments: number
    anchorFormats: string[]
    comments: CommentAnalysis[]
}

function extractPlainText(docAst: unknown): string {
    const doc = docAst as { body?: { content?: unknown[] } }
    if (!doc.body?.content) return ""

    let text = ""
    for (const element of doc.body.content) {
        text += extractTextFromElement(element)
    }
    return text
}

function extractTextFromElement(element: unknown): string {
    const el = element as {
        paragraph?: { elements?: unknown[] }
        table?: { tableRows?: unknown[] }
        sectionBreak?: unknown
    }

    if (el.paragraph?.elements) {
        let text = ""
        for (const elem of el.paragraph.elements) {
            const textRun = (elem as { textRun?: { content?: string } }).textRun
            if (textRun?.content) {
                text += textRun.content
            }
        }
        return text
    }

    if (el.table?.tableRows) {
        let text = ""
        for (const row of el.table.tableRows) {
            const tableRow = row as { tableCells?: unknown[] }
            for (const cell of tableRow.tableCells ?? []) {
                const tableCell = cell as { content?: unknown[] }
                for (const content of tableCell.content ?? []) {
                    text += extractTextFromElement(content)
                }
            }
        }
        return text
    }

    return ""
}

function analyzeComments(comments: unknown[], plainText: string): Analysis {
    const commentList = comments as Comment[]
    const analysisResults: CommentAnalysis[] = []
    const anchorFormats = new Set<string>()

    for (const comment of commentList) {
        const quotedText = comment.quotedFileContent?.value ?? null
        const anchor = comment.anchor ?? ""

        // Determine anchor format
        let anchorFormat = "unknown"
        if (anchor.startsWith("kix.")) {
            anchorFormat = "kix"
        } else if (anchor === "") {
            anchorFormat = "empty"
        } else {
            anchorFormat = "other"
        }
        anchorFormats.add(anchorFormat)

        // Find matches in document
        let matchCount = 0
        let firstMatchIndex: number | null = null
        if (quotedText) {
            let searchIndex = 0
            while (true) {
                const foundIndex = plainText.indexOf(quotedText, searchIndex)
                if (foundIndex === -1) break
                matchCount++
                if (firstMatchIndex === null) {
                    firstMatchIndex = foundIndex
                }
                searchIndex = foundIndex + 1
            }
        }

        analysisResults.push({
            id: comment.id ?? "unknown",
            quotedText,
            quotedTextLength: quotedText?.length ?? 0,
            foundInDocument: matchCount > 0,
            matchCount,
            firstMatchIndex,
            anchorFormat,
            resolved: comment.resolved ?? false,
            replyCount: comment.replies?.length ?? 0,
            hasWhitespace: quotedText
                ? /\s/.test(quotedText) && quotedText !== quotedText.trim()
                : false,
            hasNewlines: quotedText ? /\n/.test(quotedText) : false,
        })
    }

    return {
        totalComments: commentList.length,
        resolvedComments: analysisResults.filter((c) => c.resolved).length,
        unresolvedComments: analysisResults.filter((c) => !c.resolved).length,
        commentsWithQuotedText: analysisResults.filter((c) => c.quotedText)
            .length,
        commentsWithoutQuotedText: analysisResults.filter((c) => !c.quotedText)
            .length,
        commentsFoundInDocument: analysisResults.filter(
            (c) => c.foundInDocument
        ).length,
        commentsNotFoundInDocument: analysisResults.filter(
            (c) => c.quotedText && !c.foundInDocument
        ).length,
        multipleMatchComments: analysisResults.filter((c) => c.matchCount > 1)
            .length,
        anchorFormats: Array.from(anchorFormats),
        comments: analysisResults,
    }
}

function printAnalysisSummary(analysis: Analysis): void {
    console.log("\n" + "=".repeat(60))
    console.log("ANALYSIS SUMMARY")
    console.log("=".repeat(60))

    console.log(`\nComment Statistics:`)
    console.log(`  Total comments: ${analysis.totalComments}`)
    console.log(`  Resolved: ${analysis.resolvedComments}`)
    console.log(`  Unresolved: ${analysis.unresolvedComments}`)

    console.log(`\nQuoted Text Analysis:`)
    console.log(`  With quoted text: ${analysis.commentsWithQuotedText}`)
    console.log(`  Without quoted text: ${analysis.commentsWithoutQuotedText}`)
    console.log(`  Found in document: ${analysis.commentsFoundInDocument}`)
    console.log(
        `  NOT found in document: ${analysis.commentsNotFoundInDocument}`
    )
    console.log(`  Multiple matches: ${analysis.multipleMatchComments}`)

    console.log(`\nAnchor Formats: ${analysis.anchorFormats.join(", ")}`)

    // Show details of comments not found
    const notFound = analysis.comments.filter(
        (c) => c.quotedText && !c.foundInDocument
    )
    if (notFound.length > 0) {
        console.log(`\nComments NOT found in document text:`)
        for (const c of notFound) {
            console.log(`  - ID: ${c.id}`)
            console.log(`    Quoted: "${c.quotedText?.substring(0, 100)}..."`)
            console.log(
                `    Has newlines: ${c.hasNewlines}, Has leading/trailing whitespace: ${c.hasWhitespace}`
            )
        }
    }

    // Show comments with multiple matches
    const multiMatch = analysis.comments.filter((c) => c.matchCount > 1)
    if (multiMatch.length > 0) {
        console.log(`\nComments with multiple matches:`)
        for (const c of multiMatch) {
            console.log(`  - ID: ${c.id}, Matches: ${c.matchCount}`)
            console.log(`    Quoted: "${c.quotedText?.substring(0, 50)}..."`)
        }
    }

    // Key findings for Phase 2 questions
    console.log("\n" + "=".repeat(60))
    console.log("KEY FINDINGS FOR PHASE 2 QUESTIONS")
    console.log("=".repeat(60))

    console.log(
        `\n1. Anchor field format: ${analysis.anchorFormats.join(", ")}`
    )
    console.log(
        `   (kix.* format is opaque and not usable for position matching)`
    )

    const foundRate =
        analysis.commentsWithQuotedText > 0
            ? (
                  (analysis.commentsFoundInDocument /
                      analysis.commentsWithQuotedText) *
                  100
              ).toFixed(1)
            : "N/A"
    console.log(`\n2. quotedFileContent.value match rate: ${foundRate}%`)

    const withNewlines = analysis.comments.filter((c) => c.hasNewlines).length
    console.log(`\n3. Comments with newlines in quotedText: ${withNewlines}`)

    console.log(
        `\n4. Edge cases found: ${analysis.commentsNotFoundInDocument} unmatched, ${analysis.commentsWithoutQuotedText} without quotes`
    )
}

// Parse args and run
const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Investigate Google Doc comments structure

Usage:
    npx tsx devTools/gdocs/investigateGdocComments.ts [documentId]

If no documentId is provided, uses the default test document.

Options:
    -h, --help    Show this help message

Output:
    Creates devTools/gdocs/gdoc-investigation/ with:
    - document-ast.json: Full document AST from Docs API
    - comments.json: All comments from Drive API
    - plain-text.txt: Extracted plain text from document
    - analysis.json: Analysis of comments and text matching
`)
    process.exit(0)
}

const documentId =
    parsedArgs["_"].length > 0 ? parsedArgs["_"][0] : DEFAULT_DOCUMENT_ID

main(documentId).catch((error) => {
    console.error("Encountered an error:", error)
    process.exit(-1)
})
