/**
 * Round-trip test through the gdoc layer:
 *
 *   enriched content
 *     ── owidArticleToArchieMLStringGenerator ──▶ archieMlInput  (reference)
 *     ── articleToBatchUpdates ──▶ gdoc batchUpdate
 *                                  ── documents.batchUpdate ──▶ live gdoc
 *                                  ── documents.get ──▶ gdoc JSON
 *                                  ── gdocToArchie ──▶ archieMlOutput
 *
 * Compares archieMlInput vs archieMlOutput for a curated sample exercising
 * inline character styles (bold, italic, underline, strike, sup/sub, links)
 * and a couple of structural blocks. Reuses the same target gdoc across
 * runs by deleting its body before re-inserting.
 *
 * Usage:
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocs/test-roundtrip.ts
 *
 * Required env: GDOCS_PRIVATE_KEY, GDOCS_CLIENT_EMAIL, GDOCS_CLIENT_ID
 *   (already in .env for normal admin runs)
 *
 * The target doc id is hard-coded below — edit if you want to point at a
 * different test doc. The OWID service account must have edit access to it.
 */

import { docs as googleDocs } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import {
    articleToBatchUpdates,
    deleteGdocContent,
    owidArticleToArchieMLStringGenerator,
} from "../../db/model/Gdoc/archieToGdoc.js"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"
import {
    OwidGdocPostContent,
    OwidGdocType,
    EnrichedBlockText,
    EnrichedBlockHeading,
    Span,
} from "@ourworldindata/types"

const TARGET_DOC_ID = "1aa53-xlxKMx7XV-C-ISczrmy2HXtRLfuYhBrA5e95K8"

// --- Test content: a small post exercising inline styles + a heading. ---

const span = (text: string): Span => ({ spanType: "span-simple-text", text })
const wrap = (type: Span["spanType"], children: Span[], extra: any = {}) =>
    ({ spanType: type, children, ...extra }) as Span

const formattedLine: Span[] = [
    span("Plain. "),
    wrap("span-bold", [span("Bold.")]),
    span(" "),
    wrap("span-italic", [span("Italic.")]),
    span(" "),
    wrap("span-underline", [span("Underline.")]),
    span(" "),
    wrap("span-superscript", [span("sup")]),
    span("/"),
    wrap("span-subscript", [span("sub")]),
    span(" "),
    wrap("span-bold", [
        wrap("span-link", [span("bold link")], {
            url: "https://ourworldindata.org",
        }),
    ]),
    span("."),
]

const textBlock: EnrichedBlockText = {
    type: "text",
    value: formattedLine,
    parseErrors: [],
}

const headingBlock: EnrichedBlockHeading = {
    type: "heading",
    level: 2,
    text: [span("A heading at level 2")],
    parseErrors: [],
}

const trailingBlock: EnrichedBlockText = {
    type: "text",
    value: [span("A trailing paragraph with no formatting.")],
    parseErrors: [],
}

const content: OwidGdocPostContent = {
    title: "Round-trip test",
    type: OwidGdocType.Article,
    authors: ["OWID Test Bot"],
    excerpt: "Exercising the archieToGdoc → gdocToArchie loop.",
    body: [textBlock, headingBlock, trailingBlock],
} as OwidGdocPostContent

// --- Driver ---

async function main(): Promise<void> {
    if (!OwidGoogleAuth.areGdocAuthKeysSet()) {
        console.error(
            "Missing GDOCS_PRIVATE_KEY / GDOCS_CLIENT_EMAIL / GDOCS_CLIENT_ID. " +
                "Run from a shell that has the OWID admin .env loaded."
        )
        process.exit(1)
    }

    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const client = googleDocs({ version: "v1", auth })

    // --- Reference ArchieML (input side) ---
    const archieMlInput = [
        ...owidArticleToArchieMLStringGenerator(content),
    ].join("\n")

    // --- Wipe existing body ---
    process.stdout.write("Wiping existing doc body… ")
    await deleteGdocContent(client, TARGET_DOC_ID)
    console.log("done.")

    // --- Insert fresh content ---
    const requests = articleToBatchUpdates(content)
    process.stdout.write(
        `Submitting ${requests.length} batchUpdate requests… `
    )
    await client.documents.batchUpdate({
        documentId: TARGET_DOC_ID,
        requestBody: { requests },
    })
    console.log("inserted.")

    // --- Re-fetch and convert back ---
    process.stdout.write("Re-fetching and running gdocToArchie… ")
    const after = await client.documents.get({
        documentId: TARGET_DOC_ID,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    const { text: archieMlOutput } = await gdocToArchie(after.data)
    console.log("done.")

    // --- Compare ---
    const inputLines = archieMlInput.split("\n")
    const outputLines = archieMlOutput.split("\n")
    const max = Math.max(inputLines.length, outputLines.length)

    let mismatches = 0
    const diffRows: string[] = []
    for (let i = 0; i < max; i++) {
        const a = inputLines[i] ?? ""
        const b = outputLines[i] ?? ""
        if (a === b) {
            diffRows.push(`     ${i + 1}: ${a}`)
        } else {
            mismatches++
            diffRows.push(`-IN  ${i + 1}: ${a}`)
            diffRows.push(`+OUT ${i + 1}: ${b}`)
        }
    }

    console.log("\n--- archieMlInput ---")
    console.log(archieMlInput)
    console.log("\n--- archieMlOutput ---")
    console.log(archieMlOutput)
    console.log("\n--- line-by-line diff ---")
    console.log(diffRows.join("\n"))
    console.log(
        `\n${mismatches === 0 ? "✓ identical" : `✗ ${mismatches} differing line(s)`}`
    )
    console.log(
        `Open: https://docs.google.com/document/d/${TARGET_DOC_ID}/edit`
    )
    process.exit(mismatches === 0 ? 0 : 1)
}

void main().catch((err) => {
    console.error(err)
    process.exit(1)
})
