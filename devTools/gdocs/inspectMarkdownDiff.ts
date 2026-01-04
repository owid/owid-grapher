import { docs as googleDocs } from "@googleapis/docs"
import { diffLines } from "diff"
import {
    OwidGdocType,
    type GdocParagraph,
    type Span,
} from "@ourworldindata/types"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"
import {
    archieParsedToEnriched,
    archieToEnriched,
    extractRefs,
} from "../../db/model/Gdoc/archieToEnriched.js"
import { enrichedBlocksToMarkdown } from "../../db/model/Gdoc/enrichedToMarkdown.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GdocAbout } from "../../db/model/Gdoc/GdocAbout.js"
import { GdocAuthor } from "../../db/model/Gdoc/GdocAuthor.js"
import { GdocHomepage } from "../../db/model/Gdoc/GdocHomepage.js"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"
import { documentToParagraphs } from "../../db/model/Gdoc/gdocAstToParagraphs.js"
import { paragraphsToArchieText } from "../../db/model/Gdoc/paragraphsToArchie.js"
import { loadArchieFromLines } from "../../db/model/Gdoc/archieLineParser.js"
import { parseBodyParagraphBlocks } from "../../db/model/Gdoc/archieParagraphBlockParser.js"
import { paragraphBlocksToRawBody } from "../../db/model/Gdoc/paragraphBlocksToRaw.js"
import { buildRefIdToNumberMap } from "../../db/model/Gdoc/refSyntax.js"
import { attachSourceMetadata } from "../../db/model/Gdoc/gdocSourceMetadata.js"
import { parseRawBlocksToEnrichedBlocks } from "../../db/model/Gdoc/rawToEnriched.js"
import { spansToSimpleString } from "../../db/model/Gdoc/gdocUtils.js"

interface PageRow {
    id: string
    slug: string
    type: OwidGdocType
}

function getEnricher(row: PageRow): (content: Record<string, unknown>) => void {
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

function normalizeMarkdown(markdown: string | undefined): string {
    return (markdown ?? "").trim()
}

const suspiciousUrlPattern = /(loading=|allow=|style=|<iframe|"|'|\/iframe)/i

function collectSuspiciousLinks(
    spans: Span[],
    paragraph: GdocParagraph,
    output: string[]
): void {
    for (const span of spans) {
        if (span.spanType === "span-link") {
            const url = span.url ?? ""
            if (suspiciousUrlPattern.test(url)) {
                const preview = paragraph.text
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 200)
                const text = spansToSimpleString(span.children)
                output.push(
                    `Paragraph ${paragraph.index} link text="${text}" url="${url}" preview="${preview}"`
                )
            }
        }
        if ("children" in span && Array.isArray(span.children)) {
            collectSuspiciousLinks(span.children, paragraph, output)
        }
    }
}

function logSuspiciousLinks(paragraphs: GdocParagraph[]): void {
    const findings: string[] = []
    paragraphs.forEach((paragraph) => {
        if (paragraph.type !== "paragraph") return
        collectSuspiciousLinks(paragraph.spans, paragraph, findings)
    })

    if (findings.length === 0) {
        console.log("No suspicious link URLs found.")
        return
    }

    console.log("Suspicious link URLs:")
    findings.forEach((line) => console.log(line))
}

function splitArchieLines(text: string): string[] {
    return text.replace(/\r/g, "").split("\n")
}

function formatDiff(oldText: string, newText: string): string {
    const parts = diffLines(oldText, newText)
    return parts
        .map((part) => {
            const prefix = part.added ? "+" : part.removed ? "-" : " "
            return part.value
                .split("\n")
                .map((line) => `${prefix}${line}`)
                .join("\n")
        })
        .join("\n")
}

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    const verbose = args.includes("--verbose")
    const scanLinks = args.includes("--scan-links")
    const slug = args.find(
        (arg) => arg !== "--verbose" && arg !== "--scan-links"
    )
    if (!slug)
        throw new Error(
            "Usage: yarn tsx devTools/gdocs/inspectMarkdownDiff.ts [--scan-links] <slug>"
        )

    console.log(`Loading gdoc row for ${slug}...`)
    const rows = await knexReadonlyTransaction((knex) =>
        knexRaw<PageRow>(
            knex,
            `-- sql
            SELECT id, slug, type
            FROM posts_gdocs
            WHERE slug = ?
            ORDER BY updatedAt DESC
            `,
            [slug]
        )
    )

    const row = rows[0]
    if (!row) throw new Error(`No gdoc found for slug ${slug}`)

    console.log(`Found ${row.slug} (${row.id}), fetching doc...`)
    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    const response = await docsClient.documents.get({
        documentId: row.id,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })

    const document = response.data
    const enricher = getEnricher(row)

    console.log("Running old parser...")
    const { text } = await gdocToArchie(document)
    const oldContent = archieToEnriched(text, enricher)
    const oldMarkdown = normalizeMarkdown(
        enrichedBlocksToMarkdown(oldContent.body, true)
    )

    console.log("Running new parser...")
    const paragraphs = documentToParagraphs(document)
    if (verbose) console.log(`Paragraphs: ${paragraphs.length}`)
    if (scanLinks) logSuspiciousLinks(paragraphs)
    const archieText = paragraphsToArchieText(paragraphs)
    if (verbose) console.log(`Archie text length: ${archieText.length}`)
    const { extractedText, refsByFirstAppearance, rawInlineRefs } =
        extractRefs(archieText)
    if (verbose) console.log(`Refs: ${refsByFirstAppearance.size}`)
    const lines = splitArchieLines(extractedText)
    const parsedUnsanitized = loadArchieFromLines(lines)
    const refIdToNumber = buildRefIdToNumberMap(refsByFirstAppearance)
    if (verbose) console.log("Parsing paragraph blocks...")
    const { blocks: paragraphBlocks } = parseBodyParagraphBlocks(paragraphs)
    if (verbose) console.log(`Paragraph blocks: ${paragraphBlocks.length}`)
    parsedUnsanitized.body = paragraphBlocksToRawBody(
        paragraphs,
        paragraphBlocks,
        refIdToNumber
    )
    const rawBody = parsedUnsanitized.body
    if (verbose && Array.isArray(rawBody)) {
        console.log("Parsing blocks individually...")
        rawBody.forEach((block, index) => {
            if (!block || typeof block !== "object") return
            const typed = block as { type?: string }
            console.log(`Block ${index}: ${typed.type ?? "unknown"}`)
            parseRawBlocksToEnrichedBlocks(block)
        })
    }
    if (verbose) console.log("Running archieParsedToEnriched...")
    const newContent = archieParsedToEnriched(
        parsedUnsanitized,
        refsByFirstAppearance,
        rawInlineRefs,
        enricher
    )
    attachSourceMetadata(newContent.body, paragraphBlocks)
    if (verbose) console.log("New parser complete, building markdown...")
    const newMarkdown = normalizeMarkdown(
        enrichedBlocksToMarkdown(newContent.body, true)
    )
    if (verbose) console.log(`New markdown length: ${newMarkdown.length}`)
    console.log("Diffing...")

    if (oldMarkdown === newMarkdown) {
        console.log("No markdown differences.")
        process.exit(0)
    }

    console.log("Markdown diff:")
    console.log(formatDiff(oldMarkdown, newMarkdown))

    process.exit(0)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
