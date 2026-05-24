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
    wrap("span-strikethrough", [span("Strikethrough.")]),
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

// Probe-only: not asserted, just logged. Drives the future refs-handling
// commit by measuring whether `href="#note-N"` fragment URLs survive gdoc
// storage and how the round-trip degrades the ref structure today.
const refsProbeLine: Span[] = [
    span("Probe: a sentence with a footnote"),
    wrap("span-ref", [wrap("span-superscript", [span("1")])], {
        url: "#note-1",
    }),
    span(" referenced inline."),
]

const refsProbeBlock: EnrichedBlockText = {
    type: "text",
    value: refsProbeLine,
    parseErrors: [],
}

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
    body: [textBlock, headingBlock, trailingBlock, refsProbeBlock],
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
    process.stdout.write(`Submitting ${requests.length} batchUpdate requests… `)
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
    const { text: rawArchieMlOutput } = await gdocToArchie(after.data)
    // archieToGdoc's insert pattern produces one leading blank line in the
    // gdoc; strip it so the line-by-line comparison reflects content-level
    // equality, not the off-by-one. Cosmetic issue separate from formatting.
    const archieMlOutput = rawArchieMlOutput.replace(/^\n/, "")
    console.log("done.")

    // --- Compare ---
    // Refs-probe lines aren't expected to round-trip cleanly yet (refs are a
    // future commit). Detect them on the input side via `class="ref"` and
    // report them separately so the assertion only reflects the formatting
    // fixes we're shipping in this commit.
    const inputLines = archieMlInput.split("\n")
    const outputLines = archieMlOutput.split("\n")
    const max = Math.max(inputLines.length, outputLines.length)
    const isProbeLine = (line: string) => line.includes(`class="ref"`)

    let mismatches = 0
    const diffRows: string[] = []
    const probeRows: string[] = []
    for (let i = 0; i < max; i++) {
        const a = inputLines[i] ?? ""
        const b = outputLines[i] ?? ""
        if (isProbeLine(a)) {
            probeRows.push(`-IN  ${i + 1}: ${a}`)
            probeRows.push(`+OUT ${i + 1}: ${b}`)
            continue
        }
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
    console.log("\n--- line-by-line diff (excludes refs probe) ---")
    console.log(diffRows.join("\n"))
    if (probeRows.length > 0) {
        console.log(
            "\n--- refs probe (informational; refs handling is a future commit) ---"
        )
        console.log(probeRows.join("\n"))
    }
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
